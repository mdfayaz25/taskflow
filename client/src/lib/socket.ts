import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';

let socket: Socket | null = null;

export function getSocket() {
  const token = tokenStore.get();
  if (!token) return null;
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? '/', { auth: { token }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
