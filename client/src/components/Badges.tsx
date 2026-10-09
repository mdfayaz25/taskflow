import { CalendarClock } from 'lucide-react';
import type { Priority } from '@/types';
import { dueInfo } from '@/lib/dates';
import { cn } from '@/lib/utils';

const PRIORITY: Record<Priority, { label: string; cls: string; bars: number }> = {
  low: { label: 'Low', cls: 'text-slate-500 bg-slate-100', bars: 1 },
  medium: { label: 'Medium', cls: 'text-sky-700 bg-sky-50', bars: 2 },
  high: { label: 'High', cls: 'text-amber-700 bg-amber-50', bars: 3 },
  urgent: { label: 'Urgent', cls: 'text-red-700 bg-red-50', bars: 4 },
};
export const PRIORITIES = Object.keys(PRIORITY) as Priority[];

export function PriorityBadge({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const p = PRIORITY[priority];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', p.cls)} title={`${p.label} priority`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => <span key={i} className={cn('w-[3px] rounded-sm bg-current', i > p.bars && 'opacity-25')} style={{ height: 3 + i * 2 }} />)}
      </span>
      {!compact && p.label}
    </span>
  );
}

export function DueBadge({ due, done }: { due?: string; done?: boolean }) {
  const info = dueInfo(due, done);
  if (!info) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        info.tone === 'overdue' && 'bg-red-50 text-red-700',
        info.tone === 'soon' && 'bg-amber-50 text-amber-700',
        info.tone === 'later' && 'bg-surface-2 text-muted',
        info.tone === 'done' && 'bg-emerald-50 text-emerald-700 line-through decoration-emerald-700/40',
      )}
    >
      <CalendarClock className="h-3 w-3" /> {info.label}
    </span>
  );
}

const LABEL_COLORS = ['#5E5CE6', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#EF4444'];
export const labelColor = (label: string) => LABEL_COLORS[[...label].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % LABEL_COLORS.length];

export function Label({ text, onRemove }: { text: string; onRemove?: () => void }) {
  const c = labelColor(text);
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${c}14`, color: c }}>
      {text}
      {onRemove && <button onClick={onRemove} aria-label={`Remove label ${text}`} className="ml-0.5 opacity-60 hover:opacity-100">×</button>}
    </span>
  );
}
