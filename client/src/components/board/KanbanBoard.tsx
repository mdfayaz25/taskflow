import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import type { Board, Task } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { TaskCardView } from './TaskCard';

type Props = {
  board: Board;
  tasks: Task[];
  canEdit: boolean;
  isAdmin: boolean;
  onOpen: (id: string) => void;
  onMove: (taskId: string, column: string, index: number, optimistic: Task[]) => void;
  onAdd: (column: string, title: string) => Promise<unknown>;
  onRenameColumn: (id: string, name: string) => void;
  onDeleteColumn: (id: string) => void;
};

type Lanes = Record<string, Task[]>;

const toLanes = (board: Board, tasks: Task[]): Lanes =>
  Object.fromEntries(board.columns.map((c) => [c._id, tasks.filter((t) => t.column === c._id).sort((a, b) => a.order - b.order)]));

export function KanbanBoard({ board, tasks, canEdit, isAdmin, onOpen, onMove, onAdd, onRenameColumn, onDeleteColumn }: Props) {
  const [lanes, setLanes] = useState<Lanes>(() => toLanes(board, tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);

  // Follow server/socket updates whenever nothing is being dragged.
  useEffect(() => {
    if (!activeId) setLanes(toLanes(board, tasks));
  }, [board, tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findLane = (id: string) => (id.startsWith('col:') ? id.slice(4) : Object.keys(lanes).find((k) => lanes[k].some((t) => t.id === id)));
  const active = useMemo(() => (activeId ? Object.values(lanes).flat().find((t) => t.id === activeId) : null), [activeId, lanes]);

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOrigin(findLane(String(active.id)) ?? null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findLane(String(active.id));
    const to = findLane(String(over.id));
    if (!from || !to || from === to) return;
    setLanes((prev) => {
      const moving = prev[from].find((t) => t.id === active.id)!;
      const overIndex = prev[to].findIndex((t) => t.id === over.id);
      const index = overIndex === -1 ? prev[to].length : overIndex;
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== active.id),
        [to]: [...prev[to].slice(0, index), { ...moving, column: to }, ...prev[to].slice(index)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActiveId(null);
    if (!over) return setLanes(toLanes(board, tasks));
    const lane = findLane(id);
    const overLane = findLane(String(over.id));
    if (!lane || !overLane) return;
    let next = lanes;
    if (lane === overLane) {
      const oldIndex = lanes[lane].findIndex((t) => t.id === id);
      const newIndex = over.id.toString().startsWith('col:') ? lanes[lane].length - 1 : lanes[lane].findIndex((t) => t.id === over.id);
      if (oldIndex !== newIndex && newIndex >= 0) next = { ...lanes, [lane]: arrayMove(lanes[lane], oldIndex, newIndex) };
    }
    setLanes(next);
    const index = next[lane].findIndex((t) => t.id === id);
    const original = tasks.find((t) => t.id === id);
    const originalIndex = origin ? toLanes(board, tasks)[origin]?.findIndex((t) => t.id === id) : -1;
    if (original && (original.column !== lane || originalIndex !== index)) onMove(id, lane, index, Object.values(next).flat());
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); setLanes(toLanes(board, tasks)); }}>
      <div className="flex h-full items-start gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:px-6">
        {board.columns.map((c) => (
          <KanbanColumn key={c._id} column={c} tasks={lanes[c._id] ?? []} canEdit={canEdit} isAdmin={isAdmin} onOpen={onOpen} onAdd={onAdd} onRename={onRenameColumn} onDelete={onDeleteColumn} />
        ))}
        {isAdmin && <AddColumn boardId={board.id} />}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {active ? <div className="w-[284px]"><TaskCardView task={active} overlay /></div> : null}
      </DragOverlay>
    </DndContext>
  );
}


function AddColumn({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const add = useMutation({
    mutationFn: () => api.post(`/boards/${boardId}/columns`, { name: name.trim(), color: '#64748B' }),
    onSuccess: () => { setName(''); setOpen(false); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return open ? (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }} className="w-[300px] shrink-0 rounded-2xl bg-surface-2/80 p-3">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} placeholder="Column name" maxLength={40} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold outline-none focus:border-brand-400" aria-label="Column name" />
      <div className="mt-2 flex justify-end gap-1">
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-surface">Cancel</button>
        <button type="submit" className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white">Add column</button>
      </div>
    </form>
  ) : (
    <button onClick={() => setOpen(true)} className="flex w-[300px] shrink-0 items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm font-semibold text-muted transition hover:border-brand-300 hover:text-brand-600">
      <Plus className="h-4 w-4" /> Add column
    </button>
  );
}
