const DAY = 864e5;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dueInfo(due?: string, done?: boolean) {
  if (!due) return null;
  const days = Math.round((startOfDay(new Date(due)) - startOfDay(new Date())) / DAY);
  const label =
    days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : days < 0 ? `${-days}d overdue` : days < 7 ? new Date(due).toLocaleDateString('en-IN', { weekday: 'short' }) : new Date(due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const tone = done ? 'done' : days < 0 ? 'overdue' : days <= 1 ? 'soon' : 'later';
  return { days, label, tone } as const;
}

export const toInputDate = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
