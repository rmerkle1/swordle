import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { PlayerStats } from '../types';

const router = Router();

// POST / — register or upsert player with real wallet pubkey
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, pubkey } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!pubkey || typeof pubkey !== 'string' || pubkey.trim().length === 0) {
      res.status(400).json({ error: 'pubkey is required' });
      return;
    }

    // Upsert: if pubkey already exists, update the username and return existing player
    const playerRes = await query(
      `INSERT INTO players (pubkey, username) VALUES ($1, $2)
       ON CONFLICT (pubkey) DO UPDATE SET username = EXCLUDED.username
       RETURNING *`,
      [pubkey.trim(), name.trim()]
    );
    const player = playerRes.rows[0];

    // Ensure player_stats row exists
    await query(
      `INSERT INTO player_stats (player_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [player.id]
    );

    res.status(201).json({
      id: String(player.id),
      name: player.username,
      pubkey: player.pubkey,
    });
  } catch (err: any) {
    console.error('Players route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login — look up player by pubkey
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { pubkey } = req.body;
    if (!pubkey || typeof pubkey !== 'string' || pubkey.trim().length === 0) {
      res.status(400).json({ error: 'pubkey is required' });
      return;
    }

    const playerRes = await query(
      `SELECT * FROM players WHERE pubkey = $1`,
      [pubkey.trim()]
    );

    if (playerRes.rows.length === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const player = playerRes.rows[0];
    res.json({
      id: String(player.id),
      name: player.username,
      pubkey: player.pubkey,
    });
  } catch (err: any) {
    console.error('Players route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/stats — player stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) {
      res.status(400).json({ error: 'Invalid player ID' });
      return;
    }

    const statsRes = await query(
      'SELECT * FROM player_stats WHERE player_id = $1',
      [playerId]
    );
    if (statsRes.rows.length === 0) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    const row = statsRes.rows[0];
    const stats: PlayerStats = {
      gamesPlayed: row.total_games,
      wins: row.wins,
      winRate: row.total_games > 0 ? row.wins / row.total_games : 0,
      eliminations: row.eliminations,
    };

    res.json(stats);
  } catch (err: any) {
    console.error('Players route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
