import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useNotifications } from '@/hooks/queries';
import { Avatar } from '@/components/ui/Avatar';
import { cn, timeAgo } from '@/lib/utils';

export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { data } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.setQueryData(['notifications'], (d: typeof data) => d && { notifications: d.notifications.map((n) => ({ ...n, read: true })), unread: 0 }),
  });

  const unread = data?.unread ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink" aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="tabular absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn('absolute z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop', align === 'right' ? 'right-0' : 'left-0')}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-bold">Notifications</p>
              {unread > 0 && (
                <button onClick={() => readAll.mutate()} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
              )}
            </div>
            <ul className="max-h-[420px] overflow-y-auto scrollbar-thin">
              {data?.notifications.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">You're all caught up.</li>}
              {data?.notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      if (n.board) navigate(`/boards/${n.board.id}${n.task ? `?task=${n.task}` : ''}`);
                      if (!n.read) api.patch(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
                    }}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-2', !n.read && 'bg-brand-50/60')}
                  >
                    <Avatar name={n.actor?.name ?? '?'} color={n.actor?.avatarColor} size={32} />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="leading-snug"><b className="font-semibold">{n.actor?.name ?? 'Someone'}</b> {n.message}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        {n.board && <><span className="h-1.5 w-1.5 rounded-full" style={{ background: n.board.color }} />{n.board.name} ·</>} {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
