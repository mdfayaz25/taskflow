import { AnimatePresence, motion } from 'framer-motion';
import { Home, LogOut, Menu, Plus, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBoards } from '@/hooks/queries';
import { useGlobalRealtime } from '@/hooks/useRealtime';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { BoardIcon } from '../BoardIcon';
import { NewBoardModal } from '../NewBoardModal';
import { NotificationBell } from './NotificationBell';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { user, logout } = useAuth();
  const { data: boards } = useBoards();
  const [creating, setCreating] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  useGlobalRealtime();
  useEffect(() => setMobileOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-3 py-4">
      <div className="flex items-center justify-between px-2">
        <Logo />
        <NotificationBell align="left" />
      </div>
      <nav className="space-y-0.5">
        <NavLink to="/" end className={({ isActive }) => cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition', isActive ? 'bg-surface text-ink shadow-card' : 'text-muted hover:bg-surface/70 hover:text-ink')}>
          <Home className="h-4 w-4" /> Home
        </NavLink>
      </nav>
      <div className="min-h-0 flex-1">
        <div className="mb-2 flex items-center justify-between px-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-muted">Boards</p>
          <button onClick={() => setCreating(true)} className="grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-ink" aria-label="Create board"><Plus className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-0.5 overflow-y-auto scrollbar-thin">
          {boards?.map((b) => (
            <NavLink key={b.id} to={`/boards/${b.id}`} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition', isActive ? 'bg-surface text-ink shadow-card' : 'text-muted hover:bg-surface/70 hover:text-ink')}>
              <BoardIcon icon={b.icon} color={b.color} size={22} />
              <span className="truncate">{b.name}</span>
            </NavLink>
          ))}
          {boards?.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">No boards yet.</p>}
        </nav>
      </div>
      {user && (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5">
          <Avatar name={user.name} color={user.avatarColor} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button onClick={logout} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface-2/60 lg:block">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <Logo />
          <NotificationBell />
        </header>
        <main className="min-w-0 flex-1">
          <Suspense fallback={<div className="grid h-[60vh] place-items-center"><Spinner className="h-7 w-7" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute inset-y-0 left-0 w-72 bg-bg shadow-pop">
              <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg bg-surface" aria-label="Close menu"><X className="h-4 w-4" /></button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <NewBoardModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
