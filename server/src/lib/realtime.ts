import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from './jwt.js';
import { Board } from '../models/Board.js';
import { User } from '../models/User.js';

let io: Server | null = null;

/** Who is looking at each board right now: boardId -> userId -> open socket count */
const viewers = new Map<string, Map<string, number>>();

async function broadcastViewers(boardId: string) {
  const ids = [...(viewers.get(boardId)?.keys() ?? [])];
  io?.to(`board:${boardId}`).emit('board:viewers', { boardId, userIds: ids });
}

export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      socket.data.userId = verifyToken(token).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    const joined = new Set<string>();

    socket.on('board:join', async (boardId: string) => {
      const allowed = await Board.exists({ _id: boardId, 'members.user': userId }).catch(() => null);
      if (!allowed) return;
      socket.join(`board:${boardId}`);
      joined.add(boardId);
      const map = viewers.get(boardId) ?? new Map<string, number>();
      map.set(userId, (map.get(userId) ?? 0) + 1);
      viewers.set(boardId, map);
      broadcastViewers(boardId);
    });

    const leave = (boardId: string) => {
      if (!joined.has(boardId)) return;
      joined.delete(boardId);
      socket.leave(`board:${boardId}`);
      const map = viewers.get(boardId);
      if (!map) return;
      const n = (map.get(userId) ?? 1) - 1;
      if (n <= 0) map.delete(userId);
      else map.set(userId, n);
      broadcastViewers(boardId);
    };

    socket.on('board:leave', leave);
    socket.on('disconnect', () => [...joined].forEach(leave));
  });

  return io;
}

export function emitToBoard(boardId: string, event: string, payload: unknown) {
  io?.to(`board:${boardId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export async function userName(id: string) {
  return (await User.findById(id).select('name'))?.name ?? 'Someone';
}
