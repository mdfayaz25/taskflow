import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, MessageSquare } from 'lucide-react';
import { memo } from 'react';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';
import { AvatarStack } from '../AvatarStack';
import { DueBadge, Label, PriorityBadge } from '../Badges';

type Props = { task: Task; done?: boolean; onOpen?: (id: string) => void; overlay?: boolean; disabled?: boolean };

export const TaskCardView = memo(function TaskCardView({ task, done, overlay }: Omit<Props, 'onOpen' | 'disabled'>) {
  const checks = task.checklist.length;
  const checked = task.checklist.filter((c) => c.done).length;
  return (
    <div className={cn('group rounded-xl border border-line bg-surface p-3 text-left shadow-card transition', overlay ? 'rotate-[2.5deg] shadow-pop ring-2 ring-brand-500/40' : 'hover:border-brand-300 hover:shadow-lift')}>
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">{task.labels.slice(0, 3).map((l) => <Label key={l} text={l} />)}</div>
      )}
      <p className={cn('text-[13.5px] font-semibold leading-snug', done && 'text-muted line-through decoration-muted/50')}>{task.title}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} compact />
        <DueBadge due={task.dueDate} done={done} />
        {checks > 0 && (
          <span className={cn('tabular inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', checked === checks ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-muted')}>
            <CheckSquare className="h-3 w-3" /> {checked}/{checks}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="tabular inline-flex items-center gap-1 text-[11px] font-semibold text-muted"><MessageSquare className="h-3 w-3" /> {task.commentCount}</span>
        )}
        {task.assignees.length > 0 && <span className="ml-auto"><AvatarStack users={task.assignees} size={22} max={3} /></span>}
      </div>
    </div>
  );
});

export function SortableTaskCard({ task, done, onOpen, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { type: 'task', column: task.column }, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(task.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter') onOpen?.(task.id);
      }}
      aria-label={`${task.title}. Press space to pick up, enter to open.`}
    >
      <TaskCardView task={task} done={done} />
    </div>
  );
}
