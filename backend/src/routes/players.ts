import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { PlayerStats } from '../types';

const router = Router();

// POST / — register player
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const pubkey = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const playerRes = await query(
      `INSERT INTO players (pubkey, username) VALUES ($1, $2) RETURNING *`,
      [pubkey, name.trim()]
    );
    const player = playerRes.rows[0];

    await query(
      `INSERT INTO player_stats (player_id) VALUES ($1)`,
      [player.id]
    );

    res.status(201).json({
      id: String(player.id),
      name: player.username,
      pubkey: player.pubkey,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
