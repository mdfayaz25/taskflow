import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ListTodo, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBoards, useMyTasks, useNotifications } from '@/hooks/queries';
import { BoardIcon } from '@/components/BoardIcon';
import { AvatarStack } from '@/components/AvatarStack';
import { DueBadge, PriorityBadge } from '@/components/Badges';
import { NewBoardModal } from '@/components/NewBoardModal';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { dueInfo, greeting } from '@/lib/dates';
import { timeAgo } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const boards = useBoards();
  const mine = useMyTasks();
  const notes = useNotifications();
  const [creating, setCreating] = useState(false);

  const tasks = mine.data?.tasks ?? [];
  const overdue = tasks.filter((t) => (dueInfo(t.dueDate)?.days ?? 1) < 0).length;
  const thisWeek = tasks.filter((t) => { const d = dueInfo(t.dueDate)?.days; return d !== undefined && d >= 0 && d <= 7; }).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{greeting()}, {user?.name.split(' ')[0]}</h1>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New board</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListTodo} label="Open tasks" value={tasks.length} tone="#5E5CE6" />
        <Stat icon={CalendarDays} label="Due this week" value={thisWeek} tone="#0EA5E9" />
        <Stat icon={AlertTriangle} label="Overdue" value={overdue} tone="#EF4444" />
        <Stat icon={CheckCircle2} label="Done this week" value={mine.data?.completedThisWeek ?? 0} tone="#10B981" />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Your boards</h2>
          <span className="tabular text-sm text-muted">{boards.data?.length ?? 0} boards</span>
        </div>
        {boards.data?.length === 0 ? (
          <EmptyState icon={ListTodo} title="No boards yet" text="Create a board to start planning work with your team." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create board</Button>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(boards.isLoading ? Array.from({ length: 3 }, () => null) : boards.data!).map((b, i) =>
              b ? (
                <Link key={b.id} to={`/boards/${b.id}`} className="group card relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: b.color }} />
                  <div className="flex items-start gap-3">
                    <BoardIcon icon={b.icon} color={b.color} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{b.name}</p>
                      <p className="line-clamp-2 text-sm text-muted">{b.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="flex justify-between text-xs font-semibold text-muted">
                      <span className="tabular">{b.doneCount}/{b.taskCount} done</span>
                      <span className="capitalize">{b.role}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${b.taskCount ? ((b.doneCount ?? 0) / b.taskCount) * 100 : 0}%`, background: b.color }} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <AvatarStack users={b.members.map((m) => m.user)} size={26} />
                    <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-ink" />
                  </div>
                </Link>
              ) : (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface" />
              ),
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-bold">Up next for you</h2>
            <span className="tabular text-sm text-muted">{tasks.length} open</span>
          </div>
          <ul className="divide-y divide-line">
            {tasks.slice(0, 7).map((t) => {
              const b = typeof t.board === 'object' ? t.board : null;
              const col = b?.columns.find((c) => c._id === t.column);
              return (
                <li key={t.id}>
                  <Link to={`/boards/${b?.id}?task=${t.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-2/60">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: b?.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.title}</p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted">{b?.name} <span className="text-line">·</span> <span className="h-1.5 w-1.5 rounded-full" style={{ background: col?.color }} /> {col?.name}</p>
                    </div>
                    <PriorityBadge priority={t.priority} compact />
                    <DueBadge due={t.dueDate} />
                  </Link>
                </li>
              );
            })}
            {!mine.isLoading && tasks.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">Nothing assigned to you. Enjoy the calm.</li>}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-bold">Recent activity</h2></div>
          <ul className="space-y-4 px-5 py-4">
            {notes.data?.notifications.slice(0, 6).map((n) => (
              <li key={n.id} className="flex gap-3 text-sm">
                <Avatar name={n.actor?.name ?? '?'} color={n.actor?.avatarColor} size={30} />
                <div className="min-w-0">
                  <p className="leading-snug"><b className="font-semibold">{n.actor?.name}</b> {n.message}</p>
                  <p className="text-xs text-muted">{n.board?.name} · {timeAgo(n.createdAt)}</p>
                </div>
              </li>
            ))}
            {notes.data?.notifications.length === 0 && <li className="py-6 text-center text-sm text-muted">No activity yet.</li>}
          </ul>
        </section>
      </div>

      <NewBoardModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ListTodo; label: string; value: number; tone: string }) {
  return (
    <div className="card p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${tone}14`, color: tone }}><Icon className="h-[18px] w-[18px]" /></span>
      <p className="tabular mt-3 text-3xl font-extrabold">{value}</p>
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
