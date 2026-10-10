/* eslint-disable @typescript-eslint/no-explicit-any */
import seed from './seed.json';
import { createAdapter, createFakeSocket, createRouter, createStore, fail, newId, now, withStatus } from './kernel';

type Doc = Record<string, any>;
type DB = { users: Doc[]; boards: Doc[]; tasks: Doc[]; comments: Doc[]; notifications: Doc[] };

export const store = createStore<DB>('taskflow.demo.v1', seed as unknown as { exportedAt: string; data: DB });
const db = () => store.db;

const RANK = { viewer: 0, member: 1, admin: 2 } as const;
type Role = keyof typeof RANK;
const ROLES = Object.keys(RANK) as Role[];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const DEFAULT_COLUMNS = [
  { name: 'Backlog', color: '#94A3B8' },
  { name: 'To do', color: '#3B82F6' },
  { name: 'In progress', color: '#F59E0B' },
  { name: 'Review', color: '#A855F7' },
  { name: 'Done', color: '#10B981', isDone: true },
];
const COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#10B981', '#EF4444', '#EAB308', '#EC4899', '#14B8A6'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const publicUser = ({ password: _p, ...u }: Doc) => u;
const userRef = (id: string, fields = ['name', 'avatarColor']) => {
  const u = db().users.find((x) => x.id === id);
  return u ? Object.fromEntries([['id', u.id], ...fields.map((f) => [f, u[f]])]) : null;
};
const me = (userId: string | null) => db().users.find((u) => u.id === userId) ?? fail(401, 'Please sign in to continue');
const token = (u: Doc) => `demo.${u.id}`;
const touch = <T extends Doc>(d: T) => Object.assign(d, { updatedAt: now() });
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// ---------- realtime ----------
const viewers = new Map<string, Set<string>>();
let currentUser: string | null = null;
export const socket = createFakeSocket((event, boardId: string) => {
  if (event === 'board:join') {
    const board = db().boards.find((b) => b.id === boardId);
    if (!board || !currentUser) return;
    // Pretend a couple of teammates have the board open too, so presence is visible.
    const others = board.members.map((m: Doc) => m.user).filter((id: string) => id !== currentUser).slice(0, 2);
    viewers.set(boardId, new Set([currentUser, ...others]));
    socket.deliver('board:viewers', { boardId, userIds: [...viewers.get(boardId)!] });
  }
  if (event === 'board:leave') viewers.delete(boardId);
});
const emit = (event: string, payload: unknown) => socket.deliver(event, payload);

function notify(o: { recipients: string[]; actor: string; board?: string; task?: string; type: string; message: string }) {
  const ids = [...new Set(o.recipients.map(String))].filter((id) => id !== o.actor);
  for (const recipient of ids) {
    const n = { id: newId(), recipient, actor: o.actor, board: o.board, task: o.task, type: o.type, message: o.message, read: false, createdAt: now(), updatedAt: now() };
    db().notifications.push(n);
    if (recipient === currentUser) emit('notification:new', populateNotification(n));
  }
}
const populateNotification = (n: Doc) => {
  const b = db().boards.find((x) => x.id === n.board);
  return { ...n, actor: n.actor ? userRef(n.actor) : null, board: b ? { id: b.id, name: b.name, color: b.color } : null };
};

// ---------- helpers ----------
function boardFor(boardId: string, userId: string | null, min: Role = 'viewer') {
  const board = db().boards.find((b) => b.id === boardId);
  const member = board?.members.find((m: Doc) => m.user === userId);
  if (!board || !member) fail(404, 'Board not found');
  if (RANK[member.role as Role] < RANK[min]) fail(403, min === 'admin' ? 'Only board admins can do that' : 'Viewers cannot edit this board');
  return { board: board!, role: member.role as Role };
}
const fullBoard = (b: Doc) => ({ ...b, members: b.members.map((m: Doc) => ({ ...m, user: userRef(m.user, ['name', 'email', 'avatarColor']) })) });
const fullTask = (t: Doc) => ({ ...t, assignees: t.assignees.map((id: string) => userRef(id)).filter(Boolean) });
const boardUpdated = (b: Doc) => {
  touch(b);
  store.save();
  const full = fullBoard(b);
  emit('board:updated', full);
  return { board: full };
};
function loadTask(id: string, userId: string | null, min: Role = 'member') {
  const task = db().tasks.find((t) => t.id === id) ?? fail(404, 'Task not found');
  return { task, ...boardFor(task.board, userId, min) };
}
function assertMembers(board: Doc, ids: string[] = []) {
  const set = new Set(board.members.map((m: Doc) => m.user));
  if (ids.some((id) => !set.has(id))) fail(400, 'Assignees must be members of the board');
}
function taskFields(body: Doc, partial: boolean) {
  const out: Doc = {};
  if (!partial || 'title' in body) {
    const title = str(body.title);
    if (!title) fail(400, 'title: Give the task a title');
    if (title.length > 140) fail(400, 'title: Keep the title under 140 characters');
    out.title = title;
  }
  if ('description' in body) out.description = str(body.description).slice(0, 5000);
  if ('priority' in body) {
    if (!PRIORITIES.includes(body.priority)) fail(400, 'priority: Invalid priority');
    out.priority = body.priority;
  }
  if ('assignees' in body) out.assignees = [...new Set((body.assignees ?? []) as string[])].slice(0, 10);
  if ('labels' in body) out.labels = ((body.labels ?? []) as string[]).map(str).filter(Boolean).slice(0, 6);
  if ('dueDate' in body) out.dueDate = body.dueDate ? new Date(body.dueDate).toISOString() : null;
  if ('checklist' in body) out.checklist = ((body.checklist ?? []) as Doc[]).filter((c) => str(c.text)).slice(0, 30).map((c) => ({ _id: c._id ?? newId(), text: str(c.text), done: Boolean(c.done) }));
  return out;
}

const r = createRouter();

// ---------- auth ----------
r.post('/auth/register', ({ body }) => {
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  if (name.length < 2) fail(400, 'name: Name must be at least 2 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'email: Enter a valid email');
  if (String(body.password ?? '').length < 8) fail(400, 'password: Password must be at least 8 characters');
  if (db().users.some((u) => u.email === email)) fail(409, 'An account with this email already exists');
  const user = { id: newId(), name, email, password: body.password, role: 'user', avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)], createdAt: now(), updatedAt: now() };
  db().users.push(user);
  store.save();
  currentUser = user.id;
  return withStatus(201, { user: publicUser(user), token: token(user) });
}, false);
r.post('/auth/login', ({ body }) => {
  const user = db().users.find((u) => u.email === str(body.email).toLowerCase());
  if (!user || user.password !== body.password) fail(401, 'Incorrect email or password');
  currentUser = user!.id;
  return { user: publicUser(user!), token: token(user!) };
}, false);
r.get('/auth/me', ({ userId }) => {
  currentUser = userId;
  return { user: publicUser(me(userId)) };
});
r.patch('/auth/me', ({ userId, body }) => {
  const u = me(userId);
  if (body.name !== undefined) {
    if (str(body.name).length < 2) fail(400, 'name: Name must be at least 2 characters');
    u.name = str(body.name);
  }
  touch(u);
  store.save();
  return { user: publicUser(u) };
});

// ---------- boards ----------
r.get('/boards', ({ userId }) => {
  const boards = db().boards.filter((b) => b.members.some((m: Doc) => m.user === userId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    boards: boards.map((b) => {
      const done = new Set(b.columns.filter((c: Doc) => c.isDone).map((c: Doc) => c._id));
      const tasks = db().tasks.filter((t) => t.board === b.id);
      return {
        ...b,
        members: b.members.map((m: Doc) => ({ ...m, user: userRef(m.user) })),
        role: b.members.find((m: Doc) => m.user === userId)?.role,
        taskCount: tasks.length,
        doneCount: tasks.filter((t) => done.has(t.column)).length,
      };
    }),
  };
});
function boardBody(body: Doc, partial: boolean) {
  const out: Doc = {};
  if (!partial || 'name' in body) {
    const name = str(body.name);
    if (name.length < 2 || name.length > 60) fail(400, 'name: Board name must be 2–60 characters');
    out.name = name;
  }
  if ('description' in body) out.description = str(body.description).slice(0, 280);
  if ('color' in body) {
    if (!HEX.test(body.color)) fail(400, 'color: Invalid colour');
    out.color = body.color;
  }
  if ('icon' in body) out.icon = String(body.icon).slice(0, 30);
  return out;
}
r.post('/boards', ({ userId, body }) => {
  me(userId);
  const board = {
    id: newId(), description: '', color: '#5E5CE6', icon: 'layout', ...boardBody(body, false),
    owner: userId, members: [{ user: userId, role: 'admin', joinedAt: now() }],
    columns: DEFAULT_COLUMNS.map((c) => ({ _id: newId(), isDone: false, ...c })),
    createdAt: now(), updatedAt: now(),
  };
  db().boards.push(board);
  store.save();
  return withStatus(201, { board });
});
r.get('/boards/:id', ({ params, userId }) => {
  const { board, role } = boardFor(params.id, userId);
  const tasks = db().tasks.filter((t) => t.board === board.id).sort((a, b) => a.order - b.order).map(fullTask);
  return { board: fullBoard(board), tasks, role };
});
r.patch('/boards/:id', ({ params, userId, body }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  Object.assign(board, boardBody(body, true));
  return boardUpdated(board);
});
r.delete('/boards/:id', ({ params, userId }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  const d = db();
  d.tasks = d.tasks.filter((t) => t.board !== board.id);
  d.comments = d.comments.filter((c) => c.board !== board.id);
  d.boards = d.boards.filter((b) => b.id !== board.id);
  store.save();
  return undefined;
});

// members
r.post('/boards/:id/members', ({ params, userId, body }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  const role = (body.role ?? 'member') as Role;
  if (!ROLES.includes(role)) fail(400, 'role: Invalid role');
  const user = db().users.find((u) => u.email === str(body.email).toLowerCase()) ?? fail(404, 'No TaskFlow account uses that email yet');
  if (board.members.some((m: Doc) => m.user === user.id)) fail(409, `${user.name} is already on this board`);
  board.members.push({ user: user.id, role, joinedAt: now() });
  notify({ recipients: [user.id], actor: userId!, board: board.id, type: 'added_to_board', message: `added you to ${board.name}` });
  return withStatus(201, boardUpdated(board));
});
r.patch('/boards/:id/members/:userId', ({ params, userId, body }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  const member = board.members.find((m: Doc) => m.user === params.userId) ?? fail(404, 'Member not found');
  if (board.owner === params.userId) fail(400, "The board owner's role can't be changed");
  if (!ROLES.includes(body.role)) fail(400, 'role: Invalid role');
  member.role = body.role;
  return boardUpdated(board);
});
r.delete('/boards/:id/members/:userId', ({ params, userId }) => {
  const self = params.userId === userId;
  const { board } = boardFor(params.id, userId, self ? 'viewer' : 'admin');
  if (board.owner === params.userId) fail(400, 'The board owner cannot be removed');
  board.members = board.members.filter((m: Doc) => m.user !== params.userId);
  for (const t of db().tasks) if (t.board === board.id) t.assignees = t.assignees.filter((a: string) => a !== params.userId);
  if (self) emit('boards:changed', {});
  return boardUpdated(board);
});

// columns
function columnBody(body: Doc, partial: boolean) {
  const out: Doc = {};
  if (!partial || 'name' in body) {
    const name = str(body.name);
    if (!name || name.length > 40) fail(400, 'name: Column name must be 1–40 characters');
    out.name = name;
  }
  if ('color' in body) {
    if (!HEX.test(body.color)) fail(400, 'color: Invalid colour');
    out.color = body.color;
  }
  if ('isDone' in body) out.isDone = Boolean(body.isDone);
  return out;
}
r.post('/boards/:id/columns', ({ params, userId, body }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  if (board.columns.length >= 10) fail(400, 'A board can have up to 10 columns');
  board.columns.push({ _id: newId(), color: '#94A3B8', isDone: false, ...columnBody(body, false) });
  return withStatus(201, boardUpdated(board));
});
r.put('/boards/:id/columns/order', ({ params, userId, body }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  const ids: string[] = body.ids ?? [];
  if (ids.length !== board.columns.length || !board.columns.every((c: Doc) => ids.includes(c._id))) fail(400, 'Column list is out of date');
  board.columns.sort((a: Doc, b: Doc) => ids.indexOf(a._id) - ids.indexOf(b._id));
  return boardUpdated(board);
});
r.patch('/boards/:id/columns/:columnId', ({ params, userId, body }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  const col = board.columns.find((c: Doc) => c._id === params.columnId) ?? fail(404, 'Column not found');
  Object.assign(col, columnBody(body, true));
  return boardUpdated(board);
});
r.delete('/boards/:id/columns/:columnId', ({ params, userId }) => {
  const { board } = boardFor(params.id, userId, 'admin');
  if (board.columns.length <= 1) fail(400, 'A board needs at least one column');
  const col = board.columns.find((c: Doc) => c._id === params.columnId) ?? fail(404, 'Column not found');
  const count = db().tasks.filter((t) => t.column === col._id).length;
  if (count > 0) fail(400, `Move the ${count} task${count === 1 ? '' : 's'} out of “${col.name}” first`);
  board.columns = board.columns.filter((c: Doc) => c._id !== col._id);
  return boardUpdated(board);
});

// ---------- tasks ----------
r.post('/tasks', ({ userId, body }) => {
  const { board } = boardFor(body.board, userId, 'member');
  if (!board.columns.some((c: Doc) => c._id === body.column)) fail(400, 'That column no longer exists');
  const fields = taskFields(body, false);
  assertMembers(board, fields.assignees);
  const last = Math.max(0, ...db().tasks.filter((t) => t.column === body.column).map((t) => t.order));
  const task: Doc = {
    id: newId(), board: board.id, column: body.column, description: '', priority: 'medium', assignees: [], labels: [], checklist: [],
    ...fields, dueDate: fields.dueDate ?? undefined, order: last + 1000, commentCount: 0, createdBy: userId, createdAt: now(), updatedAt: now(),
  };
  db().tasks.push(task);
  touch(board);
  store.save();
  const full = fullTask(task);
  emit('task:upserted', full);
  if (task.assignees.length) notify({ recipients: task.assignees, actor: userId!, board: board.id, task: task.id, type: 'assigned', message: `assigned you to “${task.title}”` });
  return withStatus(201, { task: full });
});
r.get('/tasks/mine', ({ userId }) => {
  const week = Date.now() - 7 * 864e5;
  const PR = { low: 0, medium: 1, high: 2, urgent: 3 } as Record<string, number>;
  const mine = db().tasks.filter((t) => t.assignees.includes(userId));
  const tasks = mine
    .filter((t) => !t.completedAt)
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PR[b.priority] - PR[a.priority])
    .slice(0, 50)
    .map((t) => {
      const b = db().boards.find((x) => x.id === t.board);
      return { ...fullTask(t), board: b ? { id: b.id, name: b.name, color: b.color, columns: b.columns } : t.board };
    });
  return { tasks, completedThisWeek: mine.filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= week).length };
});
r.patch('/tasks/:id/move', ({ params, userId, body }) => {
  const { task, board } = loadTask(params.id, userId);
  const target = board.columns.find((c: Doc) => c._id === body.column) ?? fail(400, 'That column no longer exists');
  const from = task.column;
  const siblings = db().tasks.filter((t) => t.column === target._id && t.id !== task.id).sort((a, b) => a.order - b.order);
  const index = Math.min(Math.max(0, Number(body.index) || 0), siblings.length);
  const prev = siblings[index - 1]?.order;
  const next = siblings[index]?.order;
  let order: number;
  if (prev === undefined && next === undefined) order = 1000;
  else if (prev === undefined) order = next - 1000;
  else if (next === undefined) order = prev + 1000;
  else order = (prev + next) / 2;
  if (prev !== undefined && next !== undefined && next - prev < 0.001) {
    siblings.splice(index, 0, task);
    siblings.forEach((s, i) => (s.order = (i + 1) * 1000));
    order = (index + 1) * 1000;
  }
  task.column = target._id;
  task.order = order;
  if (target.isDone && !task.completedAt) task.completedAt = now();
  if (!target.isDone && task.completedAt) delete task.completedAt;
  touch(task);
  touch(board);
  store.save();
  const tasks = db().tasks.filter((t) => t.column === target._id || t.column === from).sort((a, b) => a.order - b.order).map(fullTask);
  emit('tasks:moved', { boardId: board.id, tasks });
  if (from !== target._id && task.assignees.length) {
    notify({
      recipients: task.assignees, actor: userId!, board: board.id, task: task.id,
      type: target.isDone ? 'completed' : 'moved',
      message: target.isDone ? `completed “${task.title}”` : `moved “${task.title}” to ${target.name}`,
    });
  }
  return { tasks };
});
r.patch('/tasks/:id', ({ params, userId, body }) => {
  const { task, board } = loadTask(params.id, userId);
  const before: string[] = [...task.assignees];
  const fields = taskFields(body, true);
  if (fields.assignees) assertMembers(board, fields.assignees);
  if (fields.dueDate === null) {
    delete task.dueDate;
    delete fields.dueDate;
  }
  Object.assign(task, fields);
  touch(task);
  store.save();
  const full = fullTask(task);
  emit('task:upserted', full);
  const added = (fields.assignees as string[] | undefined)?.filter((id) => !before.includes(id)) ?? [];
  if (added.length) notify({ recipients: added, actor: userId!, board: board.id, task: task.id, type: 'assigned', message: `assigned you to “${task.title}”` });
  return { task: full };
});
r.delete('/tasks/:id', ({ params, userId }) => {
  const { task } = loadTask(params.id, userId);
  const d = db();
  d.tasks = d.tasks.filter((t) => t.id !== task.id);
  d.comments = d.comments.filter((c) => c.task !== task.id);
  store.save();
  emit('task:deleted', { id: task.id });
  return undefined;
});

// comments
const fullComment = (c: Doc) => ({ ...c, user: userRef(c.user) });
r.get('/tasks/:id/comments', ({ params, userId }) => {
  const { task } = loadTask(params.id, userId, 'viewer');
  return { comments: db().comments.filter((c) => c.task === task.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(fullComment) };
});
r.post('/tasks/:id/comments', ({ params, userId, body }) => {
  const { task, board } = loadTask(params.id, userId, 'viewer');
  const text = str(body.body);
  if (!text) fail(400, 'body: Write a comment first');
  const comment = { id: newId(), task: task.id, board: board.id, user: userId, body: text.slice(0, 2000), createdAt: now(), updatedAt: now() };
  db().comments.push(comment);
  task.commentCount += 1;
  store.save();
  const full = fullComment(comment);
  emit('comment:added', { taskId: task.id, comment: full, commentCount: task.commentCount });
  notify({ recipients: [...task.assignees, task.createdBy], actor: userId!, board: board.id, task: task.id, type: 'commented', message: `commented on “${task.title}”` });
  return withStatus(201, { comment: full });
});

// ---------- notifications ----------
r.get('/notifications', ({ userId }) => {
  const mine = db().notifications.filter((n) => n.recipient === userId);
  return {
    notifications: [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40).map(populateNotification),
    unread: mine.filter((n) => !n.read).length,
  };
});
r.post('/notifications/read-all', ({ userId }) => {
  for (const n of db().notifications) if (n.recipient === userId) n.read = true;
  store.save();
  return { ok: true };
});
r.patch('/notifications/:id/read', ({ params, userId }) => {
  const n = db().notifications.find((x) => x.id === params.id && x.recipient === userId);
  if (n) n.read = true;
  store.save();
  return { ok: true };
});

export const demoAdapter = createAdapter(r, (t) => (t?.startsWith('demo.') ? t.slice(5) : null));
