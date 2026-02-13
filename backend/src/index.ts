import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, query } from './config/database';
import gamesRouter from './routes/games';
import movesRouter from './routes/moves';
import playersRouter from './routes/players';
import adminRouter from './routes/admin';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Mount routes
app.use('/api/games', gamesRouter);
app.use('/api/games/:id/moves', movesRouter);
app.use('/api/players', playersRouter);
app.use('/api/admin', adminRouter);

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
      `DELETE FROM games WHERE status = 'lobby' AND created_at < NOW() - INTERVAL '1 hour' RETURNING id`
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
    await testConnection();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    await cleanupStaleLobbies();
    setInterval(cleanupStaleLobbies, CLEANUP_INTERVAL_MS);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
