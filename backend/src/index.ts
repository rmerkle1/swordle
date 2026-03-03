import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { testConnection, query } from './config/database';
import gamesRouter from './routes/games';
import movesRouter from './routes/moves';
import playersRouter from './routes/players';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';
import fightersRouter from './routes/fighters';
import { setIO, socketPlayerMap } from './socket';
import { processExpiredDeadlines } from './services/deadlineProcessor';
import { ensureDefaultLobbyExists, processDefaultLobbies } from './services/defaultGameManager';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
setIO(io);

io.on('connection', (socket) => {
  socket.on('join:game', (data) => {
    // Backward-compatible: accept object { gameId, gamePlayerId } or raw gameId
    let gameId: number | string;
    let gamePlayerId: number | undefined;
    if (typeof data === 'object' && data !== null && data.gameId != null) {
      gameId = data.gameId;
      gamePlayerId = data.gamePlayerId ? Number(data.gamePlayerId) : undefined;
    } else {
      gameId = data;
    }
    socket.join(`game:${gameId}`);
    if (gamePlayerId) {
      socketPlayerMap.set(socket.id, { gameId: Number(gameId), gamePlayerId });
    }
  });
  socket.on('leave:game', (data) => {
    const gameId = typeof data === 'object' && data !== null ? data.gameId : data;
    socket.leave(`game:${gameId}`);
    socketPlayerMap.delete(socket.id);
  });
  socket.on('disconnect', () => {
    socketPlayerMap.delete(socket.id);
  });
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api/games/:id/moves', movesRouter);
app.use('/api/players', playersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/fighters', fightersRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const LOBBY_TTL_HOURS = 1;
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function cleanupStaleLobbies() {
  try {
    const result = await query(
      `DELETE FROM games WHERE status = 'lobby' AND is_default = FALSE AND created_at < NOW() - INTERVAL '1 hour' RETURNING id`
    );
    if (result.rows.length > 0) {
      console.log(`Cleaned up ${result.rows.length} stale lobby game(s)`);
    }
  } catch (err) {
    console.error('Lobby cleanup failed:', err);
  }
}

async function start() {
  try {
    // Verify required env vars
    if (!process.env.JWT_SECRET) {
      console.error('FATAL: JWT_SECRET environment variable is required');
      process.exit(1);
    }

    await testConnection();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    await cleanupStaleLobbies();
    setInterval(cleanupStaleLobbies, CLEANUP_INTERVAL_MS);

    // Ensure a default lobby always exists
    await ensureDefaultLobbyExists();

    // Check for expired move deadlines every 60 seconds
    setInterval(processExpiredDeadlines, 60_000);

    // Process default lobby deadlines every 60 seconds
    setInterval(processDefaultLobbies, 60_000);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
