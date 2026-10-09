import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CheckCircle2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Column, Task } from '@/types';
import { cn } from '@/lib/utils';
import { SortableTaskCard } from './TaskCard';

type Props = {
  column: Column;
  tasks: Task[];
  canEdit: boolean;
  isAdmin: boolean;
  onOpen: (id: string) => void;
  onAdd: (columnId: string, title: string) => Promise<unknown>;
  onRename: (columnId: string, name: string) => void;
  onDelete: (columnId: string) => void;
};

export function KanbanColumn({ column, tasks, canEdit, isAdmin, onOpen, onAdd, onRename, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column._id}`, data: { type: 'column', column: column._id } });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);
  useEffect(() => setName(column.name), [column.name]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return setAdding(false);
    await onAdd(column._id, title.trim());
    setTitle('');
    inputRef.current?.focus();
  };

  return (
    <section className="flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl bg-surface-2/80" aria-label={column.name}>
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: column.color }} />
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setRenaming(false); if (name.trim() && name !== column.name) onRename(column._id, name.trim()); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(column.name); setRenaming(false); } }}
            className="min-w-0 flex-1 rounded-md border border-brand-300 bg-surface px-1.5 py-0.5 text-sm font-bold outline-none"
            aria-label="Column name"
          />
        ) : (
          <h3 className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold">
            {column.name}
            {column.isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="Done column" />}
          </h3>
        )}
        <span className="tabular rounded-md bg-surface px-1.5 text-xs font-semibold text-muted">{tasks.length}</span>
        <div className="ml-auto flex items-center" ref={menuRef}>
          {canEdit && (
            <button onClick={() => setAdding(true)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink" aria-label={`Add task to ${column.name}`}><Plus className="h-4 w-4" /></button>
          )}
          {isAdmin && (
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink" aria-label="Column options"><MoreHorizontal className="h-4 w-4" /></button>
              {menu && (
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-surface p-1 shadow-pop">
                  <button onClick={() => { setMenu(false); setRenaming(true); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /> Rename</button>
                  <button onClick={() => { setMenu(false); onDelete(column._id); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete column</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div ref={setNodeRef} className={cn('flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scrollbar-thin transition-colors', isOver && 'rounded-xl bg-brand-50/70')}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <SortableTaskCard key={t.id} task={t} done={column.isDone} onOpen={onOpen} disabled={!canEdit} />)}
        </SortableContext>
        {tasks.length === 0 && !adding && <p className="grid flex-1 place-items-center rounded-xl border border-dashed border-line py-6 text-xs font-medium text-muted">{canEdit ? 'Drop tasks here' : 'No tasks'}</p>}
        {adding && (
          <form onSubmit={submit} className="rounded-xl border border-brand-300 bg-surface p-2 shadow-card">
            <textarea
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') { setTitle(''); setAdding(false); } }}
              placeholder="What needs doing?"
              rows={2}
              maxLength={140}
              className="w-full resize-none bg-transparent text-sm font-medium outline-none placeholder:text-muted"
              aria-label="New task title"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted"><span className="kbd">Enter</span> to add</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => { setTitle(''); setAdding(false); }} className="rounded-md px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2">Cancel</button>
                <button type="submit" className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-600">Add</button>
              </div>
            </div>
          </form>
        )}
      </div>
      {canEdit && !adding && (
        <button onClick={() => setAdding(true)} className="m-2 mt-0 flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-muted transition hover:bg-surface hover:text-ink">
          <Plus className="h-4 w-4" /> Add task
        </button>
      )}
    </section>
  );
}
