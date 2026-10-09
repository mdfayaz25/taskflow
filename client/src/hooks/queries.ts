import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Board, Notification, Task } from '@/types';
import type { BoardData } from './useRealtime';

export const useBoards = () =>
  useQuery({ queryKey: ['boards'], queryFn: async () => (await api.get<{ boards: Board[] }>('/boards')).data.boards });

export const useBoard = (id?: string) =>
  useQuery({ queryKey: ['board', id], queryFn: async () => (await api.get<BoardData>(`/boards/${id}`)).data, enabled: Boolean(id) });

export const useMyTasks = () =>
  useQuery({ queryKey: ['my-tasks'], queryFn: async () => (await api.get<{ tasks: Task[]; completedThisWeek: number }>('/tasks/mine')).data });

export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get<{ notifications: Notification[]; unread: number }>('/notifications')).data });
