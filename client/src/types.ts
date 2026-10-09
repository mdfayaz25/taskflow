export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatarColor: string;
}

export type MemberRole = 'admin' | 'member' | 'viewer';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/** A populated user reference (the API's toJSON maps _id to id). */
export interface MiniUser {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
}

export interface Column {
  _id: string;
  name: string;
  color: string;
  isDone?: boolean;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  owner: string;
  members: { user: MiniUser; role: MemberRole; joinedAt: string }[];
  columns: Column[];
  updatedAt: string;
  role?: MemberRole;
  taskCount?: number;
  doneCount?: number;
}

export interface Task {
  id: string;
  board: string | { id: string; name: string; color: string; columns: Column[] };
  column: string;
  title: string;
  description: string;
  priority: Priority;
  assignees: MiniUser[];
  labels: string[];
  dueDate?: string;
  order: number;
  checklist: { _id?: string; text: string; done: boolean }[];
  commentCount: number;
  createdBy: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  body: string;
  user: MiniUser;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'assigned' | 'commented' | 'moved' | 'completed' | 'added_to_board' | 'due_soon';
  message: string;
  read: boolean;
  actor?: MiniUser;
  board?: { id: string; name: string; color: string };
  task?: string;
  createdAt: string;
}
