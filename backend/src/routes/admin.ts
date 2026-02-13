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

    // Check all alive players submitted moves
    const nextDay = game.current_day + 1;
    const activePlayersRes = await query(
      `SELECT COUNT(*) as count FROM game_players WHERE game_id = $1 AND status = 'active'`,
      [id]
    );
    const submittedMovesRes = await query(
      `SELECT COUNT(*) as count FROM moves WHERE game_id = $1 AND day = $2`,
      [id, nextDay]
    );

    const activePlayers = parseInt(activePlayersRes.rows[0].count, 10);
    const submittedMoves = parseInt(submittedMovesRes.rows[0].count, 10);

    if (submittedMoves < activePlayers) {
      res.status(400).json({
        error: 'Not all players have submitted moves',
        activePlayers,
        submittedMoves,
      });
      return;
    }

    const updatedGame = await processDay(id);
    res.json(updatedGame);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
