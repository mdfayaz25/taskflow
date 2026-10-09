import { Types } from 'mongoose';
import { Board, type BoardRole } from '../models/Board.js';
import { AppError } from '../utils/AppError.js';

const RANK: Record<BoardRole, number> = { viewer: 0, member: 1, admin: 2 };

/** Loads a board and checks the user has at least `min` role on it. Non-members get a 404 so boards can't be probed. */
export async function boardFor(boardId: string, userId: string, min: BoardRole = 'viewer') {
  if (!Types.ObjectId.isValid(boardId)) throw AppError.notFound('Board not found');
  const board = await Board.findById(boardId);
  const member = board?.members.find((m) => String(m.user) === userId);
  if (!board || !member) throw AppError.notFound('Board not found');
  if (RANK[member.role as BoardRole] < RANK[min]) {
    throw AppError.forbidden(min === 'admin' ? 'Only board admins can do that' : 'Viewers cannot edit this board');
  }
  return { board, role: member.role as BoardRole };
}
