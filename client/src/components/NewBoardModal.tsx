import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Board } from '@/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input, Textarea } from './ui/Input';
import { BOARD_COLORS, BOARD_ICONS, BoardIcon } from './BoardIcon';
import { cn } from '@/lib/utils';

export function NewBoardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [icon, setIcon] = useState('rocket');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const create = useMutation({
    mutationFn: async () => (await api.post<{ board: Board }>('/boards', { name, description, color, icon })).data.board,
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ['boards'] });
      toast.success(`${board.name} is ready`);
      onClose();
      setName('');
      setDescription('');
      navigate(`/boards/${board.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error('Give the board a name');
    create.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create a board">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
          <BoardIcon icon={icon} color={color} size={48} />
          <div className="min-w-0">
            <p className="truncate font-bold">{name || 'Untitled board'}</p>
            <p className="text-xs text-muted">Starts with Backlog, To do, In progress, Review and Done</p>
          </div>
        </div>
        <Field label="Name" htmlFor="b-name"><Input id="b-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Website redesign" /></Field>
        <Field label="Description" htmlFor="b-desc"><Textarea id="b-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} placeholder="What is this board for?" className="min-h-[72px]" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Colour</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition', color === c && 'ring-2 ring-ink')} style={{ background: c }} />)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BOARD_ICONS).map(([k, I]) => (
                <button key={k} type="button" onClick={() => setIcon(k)} aria-label={k} className={cn('grid h-8 w-8 place-items-center rounded-lg border transition', icon === k ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:text-ink')}>
                  <I className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={create.isPending}>Create board</Button>
        </div>
      </form>
    </Modal>
  );
}
