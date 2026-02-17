import { io as ioClient, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getHost(): string {
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    return debuggerHost.split(':')[0];
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

const SOCKET_URL = `http://${getHost()}:3000`;

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

export function joinGame(gameId: string | number) {
  socket?.emit('join:game', gameId);
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
