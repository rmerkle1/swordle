import { io as ioClient, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';

const SOCKET_URL = BACKEND_URL;

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  socket = ioClient(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function joinGame(gameId: string | number, gamePlayerId?: string | number) {
  if (gamePlayerId) {
    socket?.emit('join:game', { gameId, gamePlayerId: Number(gamePlayerId) });
  } else {
    socket?.emit('join:game', gameId);
  }
}

export function leaveGame(gameId: string | number) {
  socket?.emit('leave:game', gameId);
}

export function onGameUpdate(callback: (game: any) => void): () => void {
  socket?.on('game:updated', callback);
  return () => {
    socket?.off('game:updated', callback);
  };
}

export function onGamesList(callback: (games: any[]) => void): () => void {
  socket?.on('games:list', callback);
  return () => {
    socket?.off('games:list', callback);
  };
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
