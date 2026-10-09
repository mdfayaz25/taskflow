import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Board } from '@/types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Input';
import { BOARD_COLORS } from '../BoardIcon';
import { cn } from '@/lib/utils';

export function BoardSettingsModal({ open, onClose, board }: { open: boolean; onClose: () => void; board: Board }) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [color, setColor] = useState(board.color);
  const [confirm, setConfirm] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => { if (open) { setName(board.name); setDescription(board.description); setColor(board.color); setConfirm(''); } }, [open, board]);

  const save = useMutation({
    mutationFn: () => api.patch(`/boards/${board.id}`, { name, description, color }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['boards'] }); toast.success('Board updated'); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/boards/${board.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['boards'] }); toast.success('Board deleted'); navigate('/'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Board settings">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Name" htmlFor="s-name"><Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="Description" htmlFor="s-desc"><Textarea id="s-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} className="min-h-[72px]" /></Field>
        <div className="flex flex-wrap gap-2">
          {BOARD_COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-surface', color === c && 'ring-2 ring-ink')} style={{ background: c }} />)}
        </div>
        <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save changes</Button></div>
      </form>
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-4">
        <p className="font-bold text-red-700">Delete board</p>
        <p className="mt-1 text-sm text-red-700/80">This removes the board, its tasks and comments for everyone. Type <b>{board.name}</b> to confirm.</p>
        <div className="mt-3 flex gap-2">
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type the board name to confirm" className="flex-1" />
          <Button variant="danger" disabled={confirm !== board.name} loading={remove.isPending} onClick={() => remove.mutate()} className="h-11">Delete</Button>
        </div>
      </div>
    </Modal>
  );
}
