import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';

/** The parts of a socket the app uses; the static demo provides an in-browser stand-in. */
type SocketLike = Pick<Socket, 'on' | 'off' | 'emit' | 'disconnect'>;

let socket: SocketLike | null = null;

export function getSocket(): SocketLike | null {
  const token = tokenStore.get();
  if (!token) return null;
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? '/', { auth: { token }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

/** Demo mode: route realtime events through the in-browser backend. */
export function setDemoSocket(fake: unknown) {
  socket = fake as SocketLike;
}

export function disconnectSocket() {
  if (import.meta.env.VITE_DEMO === 'true') return;
  socket?.disconnect();
  socket = null;
}
