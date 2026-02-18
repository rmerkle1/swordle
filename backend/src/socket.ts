import { Server } from 'socket.io';
import { getFullGame, getFilteredGame } from './services/gameEngine';
import { query } from './config/database';

let io: Server | null = null;

// Maps socket.id -> { gameId, gamePlayerId } for per-player fog filtering
export const socketPlayerMap = new Map<string, { gameId: number; gamePlayerId: number }>();

export function setIO(ioInstance: Server) {
  io = ioInstance;
}

export function getIO(): Server | null {
  return io;
}

export async function emitGameUpdate(gameId: number) {
  if (!io) return;
  try {
    const room = io.sockets.adapter.rooms.get(`game:${gameId}`);
    if (!room || room.size === 0) return;

    // Send each socket its own filtered view
    for (const socketId of room) {
      const mapping = socketPlayerMap.get(socketId);
      const sock = io.sockets.sockets.get(socketId);
      if (!sock) continue;

      if (mapping && mapping.gameId === gameId) {
        const filtered = await getFilteredGame(gameId, mapping.gamePlayerId);
        sock.emit('game:updated', filtered);
      } else {
        // No player mapping — send unfiltered (backward compat)
        const game = await getFullGame(gameId);
        sock.emit('game:updated', game);
      }
    }
  } catch (err) {
    console.error('emitGameUpdate failed:', err);
  }
}

export async function emitGamesList() {
  if (!io) return;
  try {
    const gamesRes = await query('SELECT * FROM games ORDER BY created_at DESC');
    const games = [];
    for (const row of gamesRes.rows) {
      const game = await getFullGame(row.id);
      games.push(game);
    }
    io.emit('games:list', games);
  } catch (err) {
    console.error('emitGamesList failed:', err);
  }
}
