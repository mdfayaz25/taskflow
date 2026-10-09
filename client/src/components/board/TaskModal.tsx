import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlignLeft, Calendar, CheckSquare, Columns3, Flag, MessageSquare, Plus, Tag, Trash2, Users, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Board, Comment, Priority, Task } from '@/types';
import { useAuth } from '@/context/AuthContext';
import type { BoardData } from '@/hooks/useRealtime';
import { toInputDate } from '@/lib/dates';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Label, PRIORITIES, PriorityBadge } from '../Badges';

type Props = { taskId: string | null; board: Board; tasks: Task[]; canEdit: boolean; onClose: () => void };

export function TaskModal({ taskId, board, tasks, canEdit, onClose }: Props) {
  const task = tasks.find((t) => t.id === taskId);
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  return (
    <AnimatePresence>
      {taskId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label="Task details"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative flex h-full w-full max-w-2xl flex-col bg-surface shadow-pop"
          >
            {task ? <TaskDetail key={task.id} task={task} board={board} canEdit={canEdit} onClose={onClose} /> : <p className="p-8 text-muted">This task no longer exists.</p>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function TaskDetail({ task, board, canEdit, onClose }: { task: Task; board: Board; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [newCheck, setNewCheck] = useState('');
  const [newLabel, setNewLabel] = useState('');
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description), [task.description]);

  const column = board.columns.find((c) => c._id === task.column);
  const key = ['board', board.id];

  const update = useMutation({
    mutationFn: async (patch: Partial<Omit<Task, 'assignees' | 'dueDate'>> & { assignees?: string[]; dueDate?: string | null }) => (await api.patch<{ task: Task }>(`/tasks/${task.id}`, patch)).data.task,
    onSuccess: (t) => qc.setQueryData<BoardData>(key, (d) => d && { ...d, tasks: d.tasks.map((x) => (x.id === t.id ? t : x)) }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const move = useMutation({
    mutationFn: async (col: string) => (await api.patch<{ tasks: Task[] }>(`/tasks/${task.id}/move`, { column: col, index: 0 })).data.tasks,
    onSuccess: (moved) => { const ids = new Set(moved.map((t) => t.id)); qc.setQueryData<BoardData>(key, (d) => d && { ...d, tasks: [...d.tasks.filter((t) => !ids.has(t.id)), ...moved] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/tasks/${task.id}`),
    onSuccess: () => { qc.setQueryData<BoardData>(key, (d) => d && { ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }); toast.success('Task deleted'); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const assigneeIds = task.assignees.map((a) => a.id);
  const toggleAssignee = (id: string) => update.mutate({ assignees: assigneeIds.includes(id) ? assigneeIds.filter((x) => x !== id) : [...assigneeIds, id] });
  const setChecklist = (checklist: Task['checklist']) => update.mutate({ checklist: checklist.map(({ text, done }) => ({ text, done })) });
  const doneCount = task.checklist.filter((c) => c.done).length;

  const addCheck = (e: FormEvent) => { e.preventDefault(); if (!newCheck.trim()) return; setChecklist([...task.checklist, { text: newCheck.trim(), done: false }]); setNewCheck(''); };
  const addLabel = (e: FormEvent) => { e.preventDefault(); const l = newLabel.trim().toLowerCase(); if (!l || task.labels.includes(l)) return setNewLabel(''); update.mutate({ labels: [...task.labels, l] }); setNewLabel(''); };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-6 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: board.color }} /> {board.name}
          <span className="text-line">/</span>
          <span className="h-2 w-2 rounded-full" style={{ background: column?.color }} /> {column?.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {canEdit && <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('Delete this task? This cannot be undone.')) remove.mutate(); }} aria-label="Delete task" className="hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="space-y-6 px-6 py-6">
          <textarea
            value={title}
            readOnly={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && update.mutate({ title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
            rows={1}
            maxLength={140}
            className="w-full resize-none bg-transparent font-display text-2xl font-extrabold leading-tight outline-none [field-sizing:content]"
            aria-label="Task title"
          />

          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[130px_1fr]">
            <Prop icon={Columns3} label="Status">
              <select disabled={!canEdit} value={task.column} onChange={(e) => move.mutate(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 font-semibold outline-none focus:border-brand-400 disabled:opacity-70" aria-label="Status">
                {board.columns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </Prop>
            <Prop icon={Flag} label="Priority">
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => (
                  <button key={p} disabled={!canEdit} onClick={() => update.mutate({ priority: p as Priority })} className={cn('rounded-lg p-0.5 ring-2 transition', task.priority === p ? 'ring-brand-400' : 'ring-transparent opacity-60 hover:opacity-100')} aria-pressed={task.priority === p}>
                    <PriorityBadge priority={p as Priority} />
                  </button>
                ))}
              </div>
            </Prop>
            <Prop icon={Calendar} label="Due date">
              <div className="flex items-center gap-2">
                <input type="date" disabled={!canEdit} value={toInputDate(task.dueDate)} onChange={(e) => update.mutate({ dueDate: e.target.value || null })} className="rounded-lg border border-line bg-surface px-2 py-1.5 font-semibold outline-none focus:border-brand-400" aria-label="Due date" />
                {task.dueDate && canEdit && <button onClick={() => update.mutate({ dueDate: null })} className="text-xs font-semibold text-muted hover:text-ink">Clear</button>}
              </div>
            </Prop>
            <Prop icon={Users} label="Assignees">
              <div className="flex flex-wrap gap-1.5">
                {board.members.map(({ user: m }) => {
                  const on = assigneeIds.includes(m.id);
                  return (
                    <button key={m.id} disabled={!canEdit} onClick={() => toggleAssignee(m.id)} aria-pressed={on} className={cn('flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold transition', on ? 'border-brand-500 bg-brand-500 text-white' : 'border-line text-muted hover:border-ink/20 hover:text-ink')}>
                      <Avatar name={m.name} color={m.avatarColor} size={22} /> {m.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </Prop>
            <Prop icon={Tag} label="Labels">
              <div className="flex flex-wrap items-center gap-1.5">
                {task.labels.map((l) => <Label key={l} text={l} onRemove={canEdit ? () => update.mutate({ labels: task.labels.filter((x) => x !== l) }) : undefined} />)}
                {canEdit && task.labels.length < 6 && (
                  <form onSubmit={addLabel}><input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="+ label" maxLength={24} className="w-20 rounded-md bg-transparent px-1 py-0.5 text-xs font-semibold outline-none placeholder:text-muted focus:bg-surface-2" aria-label="Add label" /></form>
                )}
              </div>
            </Prop>
          </dl>

          <Section icon={AlignLeft} title="Description">
            <textarea
              value={description}
              readOnly={!canEdit}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== task.description && update.mutate({ description })}
              placeholder={canEdit ? 'Add more detail, links or acceptance criteria…' : 'No description'}
              className="min-h-[96px] w-full rounded-xl border border-line bg-surface-2/40 px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-brand-400 focus:bg-surface"
              aria-label="Description"
            />
          </Section>

          <Section icon={CheckSquare} title={`Checklist${task.checklist.length ? ` · ${doneCount}/${task.checklist.length}` : ''}`}>
            {task.checklist.length > 0 && (
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / task.checklist.length) * 100}%` }} /></div>
            )}
            <ul className="space-y-1">
              {task.checklist.map((c, i) => (
                <li key={c._id ?? i} className="group flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-surface-2/60">
                  <input type="checkbox" disabled={!canEdit} checked={c.done} onChange={() => setChecklist(task.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className="h-4 w-4 accent-brand-500" aria-label={c.text} />
                  <span className={cn('flex-1 text-sm', c.done && 'text-muted line-through')}>{c.text}</span>
                  {canEdit && <button onClick={() => setChecklist(task.checklist.filter((_, j) => j !== i))} className="opacity-0 transition group-hover:opacity-100" aria-label={`Remove ${c.text}`}><X className="h-3.5 w-3.5 text-muted" /></button>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <form onSubmit={addCheck} className="mt-2 flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted" />
                <input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder="Add an item" maxLength={140} className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted" aria-label="New checklist item" />
              </form>
            )}
          </Section>

          <Comments taskId={task.id} />

          <p className="text-xs text-muted">Created {formatDate(task.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · Updated {timeAgo(task.updatedAt)}</p>
        </div>
      </div>
    </>
  );
}

function Comments({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const { data: comments } = useQuery({ queryKey: ['comments', taskId], queryFn: async () => (await api.get<{ comments: Comment[] }>(`/tasks/${taskId}/comments`)).data.comments });
  const post = useMutation({
    mutationFn: async () => (await api.post<{ comment: Comment }>(`/tasks/${taskId}/comments`, { body })).data.comment,
    onSuccess: (c) => { setBody(''); qc.setQueryData<Comment[]>(['comments', taskId], (l) => (l && !l.some((x) => x.id === c.id) ? [...l, c] : l)); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const seen = useRef<number | null>(null);
  useEffect(() => {
    // Only follow new comments; don't jump to the bottom when the drawer first opens.
    if (comments === undefined) return;
    if (seen.current !== null && comments.length > seen.current) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    seen.current = comments.length;
  }, [comments]);

  return (
    <Section icon={MessageSquare} title={`Comments${comments?.length ? ` · ${comments.length}` : ''}`}>
      <ul className="space-y-4">
        {comments?.map((c) => (
          <li key={c.id} className="flex gap-3 animate-fade-up">
            <Avatar name={c.user.name} color={c.user.avatarColor} size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-sm"><b className="font-semibold">{c.user.name}</b> <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span></p>
              <p className="mt-1 whitespace-pre-wrap rounded-xl rounded-tl-sm bg-surface-2/70 px-3 py-2 text-sm leading-relaxed">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div ref={endRef} />
      <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) post.mutate(); }} className="mt-4 flex gap-3">
        {user && <Avatar name={user.name} color={user.avatarColor} size={30} />}
        <div className="flex-1 rounded-xl border border-line bg-surface focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) post.mutate(); }} placeholder="Write a comment…" rows={2} maxLength={2000} className="w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none" aria-label="Comment" />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-[11px] text-muted"><span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to send</span>
            <Button size="sm" type="submit" loading={post.isPending} disabled={!body.trim()}>Comment</Button>
          </div>
        </div>
      </form>
    </Section>
  );
}

function Prop({ icon: Icon, label, children }: { icon: typeof Flag; label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 pt-1.5 font-medium text-muted"><Icon className="h-4 w-4" /> {label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Flag; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4 text-muted" /> {title}</h3>
      {children}
    </section>
  );
}
