import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import type { Board, Comment, Notification, Task } from '@/types';
import { useAuth } from '@/context/AuthContext';

export type BoardData = { board: Board; tasks: Task[]; role: Board['role'] };

/** Joins the board's socket room and applies live updates straight into the React Query cache. */
export function useBoardRealtime(boardId?: string) {
  const qc = useQueryClient();
  const [viewers, setViewers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !boardId) return;
    const key = ['board', boardId];
    const patch = (fn: (d: BoardData) => BoardData) => qc.setQueryData<BoardData>(key, (d) => (d ? fn(d) : d));

    const join = () => socket.emit('board:join', boardId);
    join();
    socket.on('connect', join);

    const onUpsert = (task: Task) =>
      patch((d) => {
        const exists = d.tasks.some((t) => t.id === task.id);
        return { ...d, tasks: exists ? d.tasks.map((t) => (t.id === task.id ? task : t)) : [...d.tasks, task] };
      });
    const onMoved = ({ boardId: id, tasks }: { boardId: string; tasks: Task[] }) => {
      if (id !== boardId) return;
      const ids = new Set(tasks.map((t) => t.id));
      patch((d) => ({ ...d, tasks: [...d.tasks.filter((t) => !ids.has(t.id)), ...tasks] }));
    };
    const onDeleted = ({ id }: { id: string }) => patch((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    const onBoard = (board: Board) => patch((d) => ({ ...d, board: { ...board, role: d.board.role } }));
    const onComment = ({ taskId, comment, commentCount }: { taskId: string; comment: Comment; commentCount: number }) => {
      patch((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, commentCount } : t)) }));
      qc.setQueryData<Comment[]>(['comments', taskId], (list) => (list && !list.some((c) => c.id === comment.id) ? [...list, comment] : list));
    };
    const onViewers = ({ boardId: id, userIds }: { boardId: string; userIds: string[] }) => id === boardId && setViewers(new Set(userIds));
    const onBoardDeleted = ({ id }: { id: string }) => {
      if (id !== boardId) return;
      toast.error('This board was deleted');
      qc.invalidateQueries({ queryKey: ['boards'] });
      window.location.assign('/');
    };

    socket.on('task:upserted', onUpsert);
    socket.on('tasks:moved', onMoved);
    socket.on('task:deleted', onDeleted);
    socket.on('board:updated', onBoard);
    socket.on('comment:added', onComment);
    socket.on('board:viewers', onViewers);
    socket.on('board:deleted', onBoardDeleted);
    return () => {
      socket.emit('board:leave', boardId);
      socket.off('connect', join);
      socket.off('task:upserted', onUpsert);
      socket.off('tasks:moved', onMoved);
      socket.off('task:deleted', onDeleted);
      socket.off('board:updated', onBoard);
      socket.off('comment:added', onComment);
      socket.off('board:viewers', onViewers);
      socket.off('board:deleted', onBoardDeleted);
    };
  }, [boardId, qc]);

  return { viewers };
}

/** App-wide listener: new notifications and board-list changes. */
export function useGlobalRealtime() {
  const qc = useQueryClient();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    const onNotification = (n: Notification) => {
      qc.setQueryData<{ notifications: Notification[]; unread: number }>(['notifications'], (d) => (d ? { notifications: [n, ...d.notifications], unread: d.unread + 1 } : d));
      toast(`${n.actor?.name ?? 'Someone'} ${n.message}`, { description: n.board?.name });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    };
    const onBoards = () => qc.invalidateQueries({ queryKey: ['boards'] });
    socket.on('notification:new', onNotification);
    socket.on('boards:changed', onBoards);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('boards:changed', onBoards);
    };
  }, [qc, user]);
}
