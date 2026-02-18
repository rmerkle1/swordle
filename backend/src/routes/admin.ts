import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { processDay, getFullGame } from '../services/gameEngine';

const router = Router();

// POST /process-day — advance game by one day
router.post('/process-day', async (req: Request, res: Response) => {
  try {
    const { gameId, adminSecret } = req.body;

    // Admin secret check — always required
    if (!process.env.ADMIN_SECRET) {
      res.status(500).json({ error: 'ADMIN_SECRET not configured on server' });
      return;
    }
    if (adminSecret !== process.env.ADMIN_SECRET) {
      res.status(403).json({ error: 'Invalid admin secret' });
      return;
    }

    if (!gameId) {
      res.status(400).json({ error: 'gameId is required' });
      return;
    }

    const id = parseInt(gameId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    // Verify game is active
    const gameRes = await query('SELECT * FROM games WHERE id = $1', [id]);
    if (gameRes.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const game = gameRes.rows[0];

    if (game.status !== 'active') {
      res.status(400).json({ error: 'Game is not active' });
      return;
    }

    // Auto-submit defend-in-place for missing players
    const nextDay = game.current_day + 1;
    const missingRes = await query(
      `SELECT gp.id, gp.current_position
       FROM game_players gp
       WHERE gp.game_id = $1 AND gp.status = 'active'
         AND gp.id NOT IN (
           SELECT m.game_player_id FROM moves m
           WHERE m.game_id = $1 AND m.day = $2
         )`,
      [id, nextDay]
    );

    for (const player of missingRes.rows) {
      await query(
        `INSERT INTO moves (game_id, game_player_id, day, destination, action, build_option)
         VALUES ($1, $2, $3, $4, 'defend', NULL)
         ON CONFLICT (game_id, game_player_id, day) DO NOTHING`,
        [id, player.id, nextDay, player.current_position]
      );
    }

    const updatedGame = await processDay(id);
    res.json(updatedGame);
  } catch (err: any) {
    console.error('Admin route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
