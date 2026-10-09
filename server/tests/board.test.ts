import request from 'supertest';
import { describe, expect, it } from 'vitest';
import './setup.js';
import { app, createUser } from './helpers.js';
import { Notification } from '../src/models/Notification.js';

async function boardWith() {
  const owner = await createUser({ name: 'Owner' });
  const res = await request(app).post('/api/boards').set(owner.auth).send({ name: 'Launch' });
  return { owner, board: res.body.board };
}

describe('boards', () => {
  it('creates a board with default columns and hides it from outsiders', async () => {
    const { board, owner } = await boardWith();
    expect(board.columns.map((c: { name: string }) => c.name)).toEqual(['Backlog', 'To do', 'In progress', 'Review', 'Done']);

    const list = await request(app).get('/api/boards').set(owner.auth);
    expect(list.body.boards).toHaveLength(1);

    const outsider = await createUser();
    const peek = await request(app).get(`/api/boards/${board.id}`).set(outsider.auth);
    expect(peek.status).toBe(404);
  });

  it('enforces roles: viewers read, members edit, admins manage', async () => {
    const { board, owner } = await boardWith();
    const viewer = await createUser({ email: 'viewer@example.com' });
    const member = await createUser({ email: 'member@example.com' });
    await request(app).post(`/api/boards/${board.id}/members`).set(owner.auth).send({ email: 'viewer@example.com', role: 'viewer' }).expect(201);
    await request(app).post(`/api/boards/${board.id}/members`).set(owner.auth).send({ email: 'member@example.com' }).expect(201);

    const col = board.columns[1]._id;
    const asViewer = await request(app).post('/api/tasks').set(viewer.auth).send({ board: board.id, column: col, title: 'Nope' });
    expect(asViewer.status).toBe(403);
    const asMember = await request(app).post('/api/tasks').set(member.auth).send({ board: board.id, column: col, title: 'Yes' });
    expect(asMember.status).toBe(201);
    const rename = await request(app).patch(`/api/boards/${board.id}`).set(member.auth).send({ name: 'Hijack' });
    expect(rename.status).toBe(403);

    expect(await Notification.countDocuments({ type: 'added_to_board' })).toBe(2);
  });
});

describe('tasks', () => {
  it('orders tasks, moves between columns and marks done', async () => {
    const { board, owner } = await boardWith();
    const [todo, done] = [board.columns[1]._id, board.columns[4]._id];
    const titles = ['A', 'B', 'C'];
    const ids: string[] = [];
    for (const title of titles) ids.push((await request(app).post('/api/tasks').set(owner.auth).send({ board: board.id, column: todo, title })).body.task.id);

    // Move C to the top of To do
    await request(app).patch(`/api/tasks/${ids[2]}/move`).set(owner.auth).send({ column: todo, index: 0 }).expect(200);
    let full = await request(app).get(`/api/boards/${board.id}`).set(owner.auth);
    const order = full.body.tasks.filter((t: { column: string }) => t.column === todo).map((t: { title: string }) => t.title);
    expect(order).toEqual(['C', 'A', 'B']);

    // Move A to Done → completedAt set
    await request(app).patch(`/api/tasks/${ids[0]}/move`).set(owner.auth).send({ column: done, index: 0 }).expect(200);
    full = await request(app).get(`/api/boards/${board.id}`).set(owner.auth);
    const a = full.body.tasks.find((t: { id: string }) => t.id === ids[0]);
    expect(a.column).toBe(done);
    expect(a.completedAt).toBeTruthy();
  });

  it('notifies assignees and rejects non-member assignees', async () => {
    const { board, owner } = await boardWith();
    const mate = await createUser({ email: 'mate@example.com' });
    const stranger = await createUser();
    await request(app).post(`/api/boards/${board.id}/members`).set(owner.auth).send({ email: 'mate@example.com' });

    const bad = await request(app).post('/api/tasks').set(owner.auth).send({ board: board.id, column: board.columns[0]._id, title: 'X', assignees: [stranger.user.id] });
    expect(bad.status).toBe(400);

    await request(app).post('/api/tasks').set(owner.auth).send({ board: board.id, column: board.columns[0]._id, title: 'Ship it', assignees: [mate.user.id] }).expect(201);
    const inbox = await request(app).get('/api/notifications').set(mate.auth);
    expect(inbox.body.notifications.map((n: { type: string }) => n.type)).toContain('assigned');
    expect(inbox.body.unread).toBe(2);
  });
});
