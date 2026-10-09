import mongoose, { Types } from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Board } from './models/Board.js';
import { Task } from './models/Task.js';
import { Comment } from './models/Comment.js';
import { Notification } from './models/Notification.js';

const day = 864e5;
const inDays = (n: number) => new Date(Date.now() + n * day);

type T = { col: number; title: string; priority: 'low' | 'medium' | 'high' | 'urgent'; who: number[]; due?: number; labels?: string[]; desc?: string; check?: [string, boolean][] };

async function run() {
  await connectDB();
  await Promise.all([User.deleteMany({}), Board.deleteMany({}), Task.deleteMany({}), Comment.deleteMany({}), Notification.deleteMany({})]);

  const people = await User.create([
    { name: 'Mohammed Fayaz', email: 'fayaz@taskflow.dev', password: 'Demo@1234', avatarColor: '#5E5CE6' },
    { name: 'Priya Sharma', email: 'priya@taskflow.dev', password: 'Demo@1234', avatarColor: '#EC4899' },
    { name: 'Arjun Mehta', email: 'arjun@taskflow.dev', password: 'Demo@1234', avatarColor: '#0EA5E9' },
    { name: 'Neha Kapoor', email: 'neha@taskflow.dev', password: 'Demo@1234', avatarColor: '#F59E0B' },
    { name: 'Karthik Rao', email: 'karthik@taskflow.dev', password: 'Demo@1234', avatarColor: '#10B981' },
  ]);
  const [fayaz, priya, arjun, neha, karthik] = people;

  const columns = () => [
    { name: 'Backlog', color: '#94A3B8' },
    { name: 'To do', color: '#3B82F6' },
    { name: 'In progress', color: '#F59E0B' },
    { name: 'Review', color: '#A855F7' },
    { name: 'Done', color: '#10B981', isDone: true },
  ];

  const boards = [
    {
      name: 'Website Redesign', description: 'New marketing site with a design system, faster pages and a new pricing flow.', color: '#5E5CE6', icon: 'globe',
      members: [[fayaz, 'admin'], [priya, 'admin'], [arjun, 'member'], [neha, 'member'], [karthik, 'viewer']],
      tasks: [
        { col: 0, title: 'Audit current site analytics', priority: 'low', who: [3], labels: ['research'] },
        { col: 0, title: 'Collect testimonials for the home page', priority: 'medium', who: [], labels: ['content'] },
        { col: 1, title: 'Design pricing page variants', priority: 'high', who: [1], due: 3, labels: ['design'], desc: 'Two layouts: a three-tier table and a slider for team size. Include an annual/monthly toggle.', check: [['Wireframes', true], ['High-fidelity mockups', false], ['Prototype for user tests', false]] },
        { col: 1, title: 'Set up Storybook for the design system', priority: 'medium', who: [0, 2], due: 6, labels: ['frontend'] },
        { col: 2, title: 'Build responsive navigation component', priority: 'high', who: [0], due: 1, labels: ['frontend'], desc: 'Mega-menu on desktop, full-screen sheet on mobile. Needs keyboard support and focus trapping.', check: [['Desktop mega-menu', true], ['Mobile sheet', true], ['Keyboard navigation', false], ['Unit tests', false]] },
        { col: 2, title: 'Migrate blog to MDX', priority: 'medium', who: [2], due: 4, labels: ['frontend', 'content'] },
        { col: 3, title: 'Hero section copy, round 2', priority: 'medium', who: [3], due: -1, labels: ['content'] },
        { col: 3, title: 'Lighthouse performance pass', priority: 'urgent', who: [0, 2], due: 0, labels: ['performance'], check: [['Image optimisation', true], ['Font loading', true], ['Bundle split', false]] },
        { col: 4, title: 'Kick-off workshop with stakeholders', priority: 'low', who: [1], labels: ['planning'] },
        { col: 4, title: 'Define colour and type tokens', priority: 'high', who: [1, 0], labels: ['design'] },
      ] as T[],
    },
    {
      name: 'Mobile App v2', description: 'React Native rewrite with offline mode and push notifications.', color: '#0EA5E9', icon: 'smartphone',
      members: [[fayaz, 'admin'], [arjun, 'member'], [karthik, 'member']],
      tasks: [
        { col: 1, title: 'Offline sync strategy doc', priority: 'high', who: [2], due: 5, labels: ['architecture'] },
        { col: 1, title: 'Push notification permissions flow', priority: 'medium', who: [0], due: 8, labels: ['mobile'] },
        { col: 2, title: 'Auth screens with biometrics', priority: 'urgent', who: [0, 2], due: 2, labels: ['mobile', 'security'] },
        { col: 3, title: 'Crash reporting setup', priority: 'medium', who: [4], due: 1, labels: ['devops'] },
        { col: 4, title: 'Choose navigation library', priority: 'low', who: [2], labels: ['architecture'] },
      ] as T[],
    },
    {
      name: 'Q4 Marketing Launch', description: 'Campaign for the festive season launch across email, social and partners.', color: '#F59E0B', icon: 'megaphone',
      members: [[priya, 'admin'], [fayaz, 'member'], [neha, 'member']],
      tasks: [
        { col: 1, title: 'Email sequence: 4 emails', priority: 'high', who: [3], due: 4, labels: ['email'] },
        { col: 2, title: 'Landing page for the launch', priority: 'high', who: [0], due: 3, labels: ['web'] },
        { col: 3, title: 'Partner co-marketing brief', priority: 'medium', who: [1], due: 2, labels: ['partners'] },
        { col: 4, title: 'Budget sign-off', priority: 'medium', who: [1], labels: ['planning'] },
      ] as T[],
    },
  ];

  for (const [bi, b] of boards.entries()) {
    const owner = b.members[0][0] as (typeof people)[number];
    const board = await Board.create({
      name: b.name, description: b.description, color: b.color, icon: b.icon, owner: owner._id,
      members: b.members.map(([u, role]) => ({ user: (u as (typeof people)[number])._id, role })),
      columns: columns(),
      updatedAt: inDays(-bi),
    });
    const order: Record<number, number> = {};
    for (const t of b.tasks) {
      order[t.col] = (order[t.col] ?? 0) + 1000;
      const col = board.columns[t.col];
      const task = await Task.create({
        board: board._id, column: col._id, title: t.title, description: t.desc ?? '', priority: t.priority,
        assignees: t.who.map((i) => people[i]._id), labels: t.labels ?? [], dueDate: t.due !== undefined ? inDays(t.due) : undefined,
        order: order[t.col], checklist: (t.check ?? []).map(([text, done]) => ({ text, done })), createdBy: owner._id,
        completedAt: col.isDone ? inDays(-2) : undefined,
      });
      if (t.priority === 'urgent' || t.desc) {
        const lines = ['Pushed a first pass, can someone take a look?', 'Looks good. Left two small notes inline.', 'Blocked on the API change, should be unblocked tomorrow.'];
        for (let k = 0; k < 2; k++) {
          await Comment.create({ task: task._id, board: board._id, user: people[(t.who[0] ?? 0) + k + 1 > 4 ? 1 : (t.who[0] ?? 0) + k + 1]._id, body: lines[(k + bi) % lines.length], createdAt: new Date(Date.now() - (3 - k) * 36e5) });
        }
        task.commentCount = 2;
        await task.save();
      }
    }
  }

  const web = await Board.findOne({ name: 'Website Redesign' });
  const nav = await Task.findOne({ title: /navigation component/ });
  const perf = await Task.findOne({ title: /Lighthouse/ });
  await Notification.create([
    { recipient: fayaz._id, actor: priya._id, board: web!._id, task: perf!._id, type: 'assigned', message: `assigned you to “${perf!.title}”`, createdAt: new Date(Date.now() - 12 * 6e4) },
    { recipient: fayaz._id, actor: arjun._id, board: web!._id, task: nav!._id, type: 'commented', message: `commented on “${nav!.title}”`, createdAt: new Date(Date.now() - 50 * 6e4) },
    { recipient: fayaz._id, actor: neha._id, board: web!._id, type: 'moved', message: 'moved “Hero section copy, round 2” to Review', createdAt: new Date(Date.now() - 3 * 36e5) },
    { recipient: fayaz._id, actor: priya._id, board: web!._id, type: 'added_to_board', message: 'added you to Q4 Marketing Launch', read: true, createdAt: new Date(Date.now() - 2 * day) },
  ]);
  void Types;

  console.log('Seeded 5 users, 3 boards and their tasks.');
  console.log('Sign in → fayaz@taskflow.dev / Demo@1234 (also priya@, arjun@, neha@, karthik@)');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
