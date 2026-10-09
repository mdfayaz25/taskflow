import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Filter, Search, Settings2, UserPlus, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Priority, Task } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useBoard } from '@/hooks/queries';
import { useBoardRealtime, type BoardData } from '@/hooks/useRealtime';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { TaskModal } from '@/components/board/TaskModal';
import { MembersModal } from '@/components/board/MembersModal';
import { BoardSettingsModal } from '@/components/board/BoardSettingsModal';
import { AvatarStack } from '@/components/AvatarStack';
import { BoardIcon } from '@/components/BoardIcon';
import { PRIORITIES, PriorityBadge } from '@/components/Badges';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

export default function BoardPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError } = useBoard(id);
  const { viewers } = useBoardRealtime(id);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const key = ['board', id];

  const openTask = useCallback((taskId: string) => setParams((p) => { p.set('task', taskId); return p; }), [setParams]);
  const closeTask = useCallback(() => setParams((p) => { p.delete('task'); return p; }), [setParams]);

  const move = useMutation({
    mutationFn: async ({ taskId, column, index }: { taskId: string; column: string; index: number; optimistic: Task[] }) => (await api.patch<{ tasks: Task[] }>(`/tasks/${taskId}/move`, { column, index })).data.tasks,
    onMutate: async ({ optimistic }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BoardData>(key);
      qc.setQueryData<BoardData>(key, (d) => d && { ...d, tasks: optimistic.map((t, i) => ({ ...t, order: i })) });
      return { prev };
    },
    onSuccess: (moved) => {
      const ids = new Set(moved.map((t) => t.id));
      qc.setQueryData<BoardData>(key, (d) => d && { ...d, tasks: [...d.tasks.filter((t) => !ids.has(t.id)), ...moved] });
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); toast.error(getErrorMessage(e)); },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addTask = async (column: string, title: string) => {
    try {
      const { data: res } = await api.post<{ task: Task }>('/tasks', { board: id, column, title });
      qc.setQueryData<BoardData>(key, (d) => d && (d.tasks.some((t) => t.id === res.task.id) ? d : { ...d, tasks: [...d.tasks, res.task] }));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  const renameColumn = (colId: string, name: string) => api.patch(`/boards/${id}/columns/${colId}`, { name }).catch((e) => toast.error(getErrorMessage(e)));
  const deleteColumn = (colId: string) => api.delete(`/boards/${id}/columns/${colId}`).catch((e) => toast.error(getErrorMessage(e)));

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.tasks.filter(
      (t) =>
        (!q || t.title.toLowerCase().includes(q) || t.labels.some((l) => l.includes(q))) &&
        (!assignee || t.assignees.some((a) => a.id === assignee)) &&
        (!priority || t.priority === priority),
    );
  }, [data, search, assignee, priority]);

  if (isLoading) return <div className="grid h-[70vh] place-items-center"><Spinner className="h-7 w-7" /></div>;
  if (isError || !data) {
    return (
      <div className="grid h-[70vh] place-items-center text-center">
        <div>
          <h1 className="text-2xl font-extrabold">Board not found</h1>
          <p className="mt-1 text-muted">It may have been deleted, or you're not a member.</p>
          <Link to="/" className="mt-5 inline-block font-semibold text-brand-600 hover:underline">Back to home</Link>
        </div>
      </div>
    );
  }

  const { board, role } = data;
  const isAdmin = role === 'admin';
  const canEdit = role !== 'viewer';
  const filtering = Boolean(search || assignee || priority);
  const members = board.members.map((m) => m.user);
  const live = new Set([...viewers].filter((v) => v !== user?.id));

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col lg:h-screen">
      <header className="space-y-4 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <BoardIcon icon={board.icon} color={board.color} size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold sm:text-2xl">{board.name}</h1>
            {board.description && <p className="truncate text-sm text-muted">{board.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {live.size > 0 && (
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:flex">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative h-2 w-2 rounded-full bg-emerald-500" /></span>
                {live.size} viewing now
              </span>
            )}
            <button onClick={() => setMembersOpen(true)} className="rounded-full p-0.5 transition hover:bg-surface-2" aria-label="Members">
              <AvatarStack users={members} max={5} size={30} live={viewers} />
            </button>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => setMembersOpen(true)} className="hidden sm:inline-flex"><UserPlus className="h-4 w-4" /> Share</Button>}
            {isAdmin && <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Board settings"><Settings2 className="h-4 w-4" /></Button>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter tasks" aria-label="Filter tasks" className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10" />
          </div>
          <button onClick={() => setAssignee(assignee === user?.id ? null : user!.id)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold transition', assignee === user?.id ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted hover:text-ink')}>
            My tasks
          </button>
          <div className="relative">
            <button onClick={() => setFilterOpen((o) => !o)} className={cn('flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition', (priority || (assignee && assignee !== user?.id)) ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted hover:text-ink')}>
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
            {filterOpen && (
              <div className="absolute left-0 z-30 mt-1 w-64 space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-pop">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Assignee</p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <button key={m.id} onClick={() => setAssignee(assignee === m.id ? null : m.id)} className={cn('rounded-full ring-2 ring-offset-1 transition', assignee === m.id ? 'ring-brand-500' : 'ring-transparent')} title={m.name} aria-pressed={assignee === m.id}>
                        <Avatar name={m.name} color={m.avatarColor} size={28} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Priority</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button key={p} onClick={() => setPriority(priority === p ? null : p)} className={cn('rounded-lg p-0.5 ring-2 transition', priority === p ? 'ring-brand-400' : 'ring-transparent')}><PriorityBadge priority={p} /></button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {filtering && (
            <button onClick={() => { setSearch(''); setAssignee(null); setPriority(null); setFilterOpen(false); }} className="flex h-9 items-center gap-1 px-2 text-sm font-semibold text-muted hover:text-ink"><X className="h-3.5 w-3.5" /> Clear</button>
          )}
          {!canEdit && <span className="ml-auto rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">View only</span>}
        </div>
      </header>

      <div className="min-h-0 flex-1" onClick={() => filterOpen && setFilterOpen(false)}>
        <KanbanBoard
          board={board}
          tasks={filtered}
          canEdit={canEdit && !filtering}
          isAdmin={isAdmin}
          onOpen={openTask}
          onMove={(taskId, column, index, optimistic) => move.mutate({ taskId, column, index, optimistic: filtering ? data.tasks : optimistic })}
          onAdd={addTask}
          onRenameColumn={renameColumn}
          onDeleteColumn={deleteColumn}
        />
      </div>

      <TaskModal taskId={params.get('task')} board={board} tasks={data.tasks} canEdit={canEdit} onClose={closeTask} />
      <MembersModal open={membersOpen} onClose={() => setMembersOpen(false)} board={board} isAdmin={isAdmin} live={viewers} />
      {isAdmin && <BoardSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} board={board} />}
    </div>
  );
}
