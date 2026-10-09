import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Task, PRIORITIES } from '../models/Task.js';
import { Comment } from '../models/Comment.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { boardFor } from '../lib/access.js';
import { emitToBoard } from '../lib/realtime.js';
import { notify } from '../lib/notify.js';

const router = Router();
router.use(requireAuth);

const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid id');
const taskFields = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(140),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignees: z.array(objectId).max(10).optional(),
  labels: z.array(z.string().trim().min(1).max(24)).max(6).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  checklist: z.array(z.object({ text: z.string().trim().min(1).max(140), done: z.boolean() })).max(30).optional(),
});

async function loadTask(id: string, userId: string, min: 'viewer' | 'member' = 'member') {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Task not found');
  const task = await Task.findById(id);
  if (!task) throw AppError.notFound('Task not found');
  const { board, role } = await boardFor(String(task.board), userId, min);
  return { task, board, role };
}

const populated = (id: Types.ObjectId | string) => Task.findById(id).populate('assignees', 'name avatarColor');

function assertMembers(board: { members: { user: unknown }[] }, ids: string[] = []) {
  const memberIds = new Set(board.members.map((m) => String(m.user)));
  if (ids.some((id) => !memberIds.has(id))) throw AppError.badRequest('Assignees must be members of the board');
}

router.post(
  '/',
  validate({ body: taskFields.extend({ board: objectId, column: objectId }) }),
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.body.board, req.user!.id, 'member');
    if (!board.columns.id(req.body.column)) throw AppError.badRequest('That column no longer exists');
    assertMembers(board, req.body.assignees);
    const last = await Task.findOne({ column: req.body.column }).sort({ order: -1 }).select('order');
    const task = await Task.create({ ...req.body, order: (last?.order ?? 0) + 1000, createdBy: req.user!.id });
    const full = await populated(task._id);
    emitToBoard(String(board._id), 'task:upserted', full);
    if (req.body.assignees?.length) {
      await notify({ recipients: req.body.assignees, actor: req.user!.id, board: String(board._id), task: task.id, type: 'assigned', message: `assigned you to “${task.title}”` });
    }
    res.status(201).json({ task: full });
  }),
);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const tasks = await Task.find({ assignees: req.user!.id, completedAt: { $exists: false } })
      .sort({ dueDate: 1, priority: -1 })
      .limit(50)
      .populate('board', 'name color columns')
      .populate('assignees', 'name avatarColor');
    const completedThisWeek = await Task.countDocuments({ assignees: req.user!.id, completedAt: { $gte: new Date(Date.now() - 7 * 864e5) } });
    res.json({ tasks, completedThisWeek });
  }),
);

router.patch(
  '/:id',
  validate({ body: taskFields.partial() }),
  asyncHandler(async (req, res) => {
    const { task, board } = await loadTask(req.params.id, req.user!.id);
    const before = task.assignees.map(String);
    if (req.body.assignees) assertMembers(board, req.body.assignees);
    if (req.body.dueDate === null) {
      task.dueDate = undefined;
      delete req.body.dueDate;
    }
    Object.assign(task, req.body);
    await task.save();
    const full = await populated(task._id);
    emitToBoard(String(board._id), 'task:upserted', full);
    const added = (req.body.assignees as string[] | undefined)?.filter((id) => !before.includes(id)) ?? [];
    if (added.length) await notify({ recipients: added, actor: req.user!.id, board: String(board._id), task: task.id, type: 'assigned', message: `assigned you to “${task.title}”` });
    res.json({ task: full });
  }),
);

/**
 * Move a task to `column` at position `index`. Orders are spaced 1000 apart so most moves
 * touch a single document; the column is renumbered only when two neighbours collide.
 */
router.patch(
  '/:id/move',
  validate({ body: z.object({ column: objectId, index: z.number().int().min(0) }) }),
  asyncHandler(async (req, res) => {
    const { task, board } = await loadTask(req.params.id, req.user!.id);
    const target = board.columns.id(req.body.column);
    if (!target) throw AppError.badRequest('That column no longer exists');
    const fromColumn = String(task.column);

    const siblings = await Task.find({ column: target._id, _id: { $ne: task._id } }).sort({ order: 1 }).select('order');
    const index = Math.min(req.body.index, siblings.length);
    const prev = siblings[index - 1]?.order;
    const next = siblings[index]?.order;
    let order: number;
    if (prev === undefined && next === undefined) order = 1000;
    else if (prev === undefined) order = next! - 1000;
    else if (next === undefined) order = prev + 1000;
    else order = (prev + next) / 2;

    if (prev !== undefined && next !== undefined && next - prev < 0.001) {
      siblings.splice(index, 0, task);
      await Promise.all(siblings.map((s, i) => Task.updateOne({ _id: s._id }, { order: (i + 1) * 1000 })));
      order = (index + 1) * 1000;
    }

    task.column = target._id;
    task.order = order;
    const wasDone = Boolean(task.completedAt);
    if (target.isDone && !wasDone) task.completedAt = new Date();
    if (!target.isDone && wasDone) task.completedAt = undefined;
    await task.save();

    const tasks = await Task.find({ column: { $in: [target._id, new Types.ObjectId(fromColumn)] } }).sort({ order: 1 }).populate('assignees', 'name avatarColor');
    emitToBoard(String(board._id), 'tasks:moved', { boardId: String(board._id), tasks });

    if (fromColumn !== String(target._id) && task.assignees.length) {
      await notify({
        recipients: task.assignees,
        actor: req.user!.id,
        board: String(board._id),
        task: task.id,
        type: target.isDone ? 'completed' : 'moved',
        message: target.isDone ? `completed “${task.title}”` : `moved “${task.title}” to ${target.name}`,
      });
    }
    res.json({ tasks });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { task, board } = await loadTask(req.params.id, req.user!.id);
    await Promise.all([task.deleteOne(), Comment.deleteMany({ task: task._id })]);
    emitToBoard(String(board._id), 'task:deleted', { id: task.id });
    res.status(204).end();
  }),
);

// ---------- comments ----------
router.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { task } = await loadTask(req.params.id, req.user!.id, 'viewer');
    const comments = await Comment.find({ task: task._id }).sort({ createdAt: 1 }).populate('user', 'name avatarColor');
    res.json({ comments });
  }),
);

router.post(
  '/:id/comments',
  validate({ body: z.object({ body: z.string().trim().min(1).max(2000) }) }),
  asyncHandler(async (req, res) => {
    const { task, board } = await loadTask(req.params.id, req.user!.id, 'viewer');
    const comment = await Comment.create({ task: task._id, board: board._id, user: req.user!.id, body: req.body.body });
    task.commentCount += 1;
    await task.save();
    await comment.populate('user', 'name avatarColor');
    emitToBoard(String(board._id), 'comment:added', { taskId: task.id, comment, commentCount: task.commentCount });
    await notify({
      recipients: [...task.assignees, task.createdBy],
      actor: req.user!.id,
      board: String(board._id),
      task: task.id,
      type: 'commented',
      message: `commented on “${task.title}”`,
    });
    res.status(201).json({ comment });
  }),
);

export default router;
