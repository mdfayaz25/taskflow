import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Board, BOARD_ROLES } from '../models/Board.js';
import { Task } from '../models/Task.js';
import { Comment } from '../models/Comment.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { boardFor } from '../lib/access.js';
import { emitToBoard, emitToUser } from '../lib/realtime.js';
import { notify } from '../lib/notify.js';

const router = Router();
router.use(requireAuth);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const DEFAULT_COLUMNS = [
  { name: 'Backlog', color: '#94A3B8' },
  { name: 'To do', color: '#3B82F6' },
  { name: 'In progress', color: '#F59E0B' },
  { name: 'Review', color: '#A855F7' },
  { name: 'Done', color: '#10B981', isDone: true },
];

const populateBoard = (q: ReturnType<typeof Board.findById>) => q.populate('members.user', 'name email avatarColor');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const boards = await Board.find({ 'members.user': req.user!.id }).sort({ updatedAt: -1 }).populate('members.user', 'name avatarColor');
    const counts = await Task.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { board: { $in: boards.map((b) => b._id) } } },
      { $group: { _id: '$board', total: { $sum: 1 } } },
    ]);
    const doneCols = new Set(boards.flatMap((b) => b.columns.filter((c) => c.isDone).map((c) => String(c._id))));
    const done = await Task.aggregate<{ _id: Types.ObjectId; done: number }>([
      { $match: { board: { $in: boards.map((b) => b._id) }, column: { $in: [...doneCols].map((id) => new Types.ObjectId(id)) } } },
      { $group: { _id: '$board', done: { $sum: 1 } } },
    ]);
    const byId = (rows: { _id: Types.ObjectId }[]) => new Map(rows.map((r) => [String(r._id), r]));
    const t = byId(counts) as unknown as Map<string, { total: number }>;
    const d = byId(done) as unknown as Map<string, { done: number }>;
    res.json({
      boards: boards.map((b) => ({
        ...b.toJSON(),
        role: b.members.find((m) => String((m.user as unknown as { _id: Types.ObjectId })._id) === req.user!.id)?.role,
        taskCount: t.get(String(b._id))?.total ?? 0,
        doneCount: d.get(String(b._id))?.done ?? 0,
      })),
    });
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(280).optional(),
  color: hex.optional(),
  icon: z.string().max(30).optional(),
});

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const board = await Board.create({ ...req.body, owner: req.user!.id, members: [{ user: req.user!.id, role: 'admin' }], columns: DEFAULT_COLUMNS });
    res.status(201).json({ board });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { role } = await boardFor(req.params.id, req.user!.id);
    const [board, tasks] = await Promise.all([
      populateBoard(Board.findById(req.params.id)),
      Task.find({ board: req.params.id }).sort({ order: 1 }).populate('assignees', 'name avatarColor'),
    ]);
    res.json({ board, tasks, role });
  }),
);

router.patch(
  '/:id',
  validate({ body: createSchema.partial() }),
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    Object.assign(board, req.body);
    await board.save();
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    res.json({ board: full });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    await Promise.all([Task.deleteMany({ board: board._id }), Comment.deleteMany({ board: board._id }), board.deleteOne()]);
    emitToBoard(String(board._id), 'board:deleted', { id: String(board._id) });
    res.status(204).end();
  }),
);

// ---------- members ----------
router.post(
  '/:id/members',
  validate({ body: z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(BOARD_ROLES).default('member') }) }),
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    const user = await User.findOne({ email: req.body.email });
    if (!user) throw AppError.notFound('No TaskFlow account uses that email yet');
    if (board.members.some((m) => String(m.user) === user.id)) throw AppError.conflict(`${user.name} is already on this board`);
    board.members.push({ user: user._id, role: req.body.role, joinedAt: new Date() });
    await board.save();
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    emitToUser(user.id, 'boards:changed', {});
    await notify({ recipients: [user._id], actor: req.user!.id, board: String(board._id), type: 'added_to_board', message: `added you to ${board.name}` });
    res.status(201).json({ board: full });
  }),
);

router.patch(
  '/:id/members/:userId',
  validate({ body: z.object({ role: z.enum(BOARD_ROLES) }) }),
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    const member = board.members.find((m) => String(m.user) === req.params.userId);
    if (!member) throw AppError.notFound('Member not found');
    if (String(board.owner) === req.params.userId) throw AppError.badRequest("The board owner's role can't be changed");
    member.role = req.body.role;
    await board.save();
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    res.json({ board: full });
  }),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const self = req.params.userId === req.user!.id;
    const { board } = await boardFor(req.params.id, req.user!.id, self ? 'viewer' : 'admin');
    if (String(board.owner) === req.params.userId) throw AppError.badRequest('The board owner cannot be removed');
    board.members = board.members.filter((m) => String(m.user) !== req.params.userId) as typeof board.members;
    await board.save();
    await Task.updateMany({ board: board._id }, { $pull: { assignees: new Types.ObjectId(req.params.userId) } });
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    emitToUser(req.params.userId, 'boards:changed', {});
    res.json({ board: full });
  }),
);

// ---------- columns ----------
const columnBody = z.object({ name: z.string().trim().min(1).max(40), color: hex.optional(), isDone: z.boolean().optional() });

router.post(
  '/:id/columns',
  validate({ body: columnBody }),
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    if (board.columns.length >= 10) throw AppError.badRequest('A board can have up to 10 columns');
    board.columns.push(req.body);
    await board.save();
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    res.status(201).json({ board: full });
  }),
);

router.patch(
  '/:id/columns/:columnId',
  validate({ body: columnBody.partial() }),
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    const col = board.columns.id(req.params.columnId);
    if (!col) throw AppError.notFound('Column not found');
    Object.assign(col, req.body);
    await board.save();
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    res.json({ board: full });
  }),
);

router.put(
  '/:id/columns/order',
  validate({ body: z.object({ ids: z.array(z.string()).min(1) }) }),
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    const ids: string[] = req.body.ids;
    if (ids.length !== board.columns.length || !board.columns.every((c) => ids.includes(String(c._id)))) throw AppError.badRequest('Column list is out of date');
    board.columns.sort((a, b) => ids.indexOf(String(a._id)) - ids.indexOf(String(b._id)));
    await board.save();
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    res.json({ board: full });
  }),
);

router.delete(
  '/:id/columns/:columnId',
  asyncHandler(async (req, res) => {
    const { board } = await boardFor(req.params.id, req.user!.id, 'admin');
    if (board.columns.length <= 1) throw AppError.badRequest('A board needs at least one column');
    const col = board.columns.id(req.params.columnId);
    if (!col) throw AppError.notFound('Column not found');
    const count = await Task.countDocuments({ column: col._id });
    if (count > 0) throw AppError.badRequest(`Move the ${count} task${count === 1 ? '' : 's'} out of “${col.name}” first`);
    col.deleteOne();
    await board.save();
    const full = await populateBoard(Board.findById(board._id));
    emitToBoard(String(board._id), 'board:updated', full);
    res.json({ board: full });
  }),
);

export default router;
