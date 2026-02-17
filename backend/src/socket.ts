import { Server } from 'socket.io';
import { getFullGame } from './services/gameEngine';
import { query } from './config/database';

let io: Server | null = null;

export function setIO(ioInstance: Server) {
  io = ioInstance;
}

export function getIO(): Server | null {
  return io;
}

export async function emitGameUpdate(gameId: number) {
  if (!io) return;
  try {
    const game = await getFullGame(gameId);
    io.to(`game:${gameId}`).emit('game:updated', game);
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
