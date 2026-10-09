import { useMutation } from '@tanstack/react-query';
import { Crown, UserPlus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Board, MemberRole } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';

const ROLE_HELP: Record<MemberRole, string> = { admin: 'Manage members and columns', member: 'Create and edit tasks', viewer: 'Read and comment only' };

export function MembersModal({ open, onClose, board, isAdmin, live }: { open: boolean; onClose: () => void; board: Board; isAdmin: boolean; live: Set<string> }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');

  const invite = useMutation({
    mutationFn: () => api.post(`/boards/${board.id}/members`, { email, role }),
    onSuccess: () => { toast.success('Member added'); setEmail(''); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const change = useMutation({
    mutationFn: ({ id, role }: { id: string; role: MemberRole }) => api.patch(`/boards/${board.id}/members/${id}`, { role }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/boards/${board.id}/members/${id}`),
    onSuccess: () => toast.success('Member removed'),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); if (email.trim()) invite.mutate(); };

  return (
    <Modal open={open} onClose={onClose} title={`Members · ${board.members.length}`}>
      {isAdmin && (
        <form onSubmit={submit} className="mb-5 flex flex-wrap gap-2">
          <Input type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1" aria-label="Email" />
          <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold" aria-label="Role">
            <option value="member">Member</option><option value="viewer">Viewer</option><option value="admin">Admin</option>
          </select>
          <Button type="submit" loading={invite.isPending} className="h-11"><UserPlus className="h-4 w-4" /> Invite</Button>
          <p className="w-full text-xs text-muted">They need a TaskFlow account first. They will get a notification as soon as they are added.</p>
        </form>
      )}
      <ul className="divide-y divide-line">
        {board.members.map(({ user: m, role: r }) => {
          const isOwner = board.owner === m.id;
          return (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <span className="relative">
                <Avatar name={m.name} color={m.avatarColor} size={38} />
                {live.has(m.id) && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-surface" title="Viewing now" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold">{m.name}{m.id === user?.id && <span className="text-xs font-medium text-muted">(you)</span>}{isOwner && <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="Owner" />}</p>
                <p className="truncate text-xs text-muted">{m.email}</p>
              </div>
              {isAdmin && !isOwner ? (
                <>
                  <select value={r} onChange={(e) => change.mutate({ id: m.id, role: e.target.value as MemberRole })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold" aria-label={`Role for ${m.name}`} title={ROLE_HELP[r]}>
                    <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
                  </select>
                  <button onClick={() => remove.mutate(m.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${m.name}`}><X className="h-4 w-4" /></button>
                </>
              ) : (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold capitalize text-muted" title={ROLE_HELP[r]}>{isOwner ? 'Owner' : r}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
