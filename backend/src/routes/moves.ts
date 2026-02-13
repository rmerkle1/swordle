import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { getAdjacentTiles, processDay, getFullGame } from '../services/gameEngine';

const router = Router({ mergeParams: true });

const BUILD_COSTS: Record<string, { wood: number; metal: number }> = {
  wall: { wood: 2, metal: 1 },
  trap: { wood: 1, metal: 2 },
  upgrade: { wood: 3, metal: 1 },
};

const moveSchema = z.object({
  playerId: z.string(),
  fromTile: z.number().int().min(0),
  toTile: z.number().int().min(0),
  action: z.enum(['attack', 'defend', 'collect', 'build', 'scout']),
  buildOption: z.enum(['wall', 'trap', 'upgrade']).nullable().optional(),
});

// POST / — submit move (mounted at /api/games/:id/moves)
router.post('/', async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid move data', details: parsed.error.errors });
      return;
    }
    const { playerId, fromTile, toTile, action, buildOption } = parsed.data;

    // Fetch game
    const gameRes = await query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRes.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const game = gameRes.rows[0];

    if (game.status !== 'active') {
      res.status(400).json({ error: 'Game is not active' });
      return;
    }

    const gamePlayerId = parseInt(playerId, 10);

    // Fetch player
    const playerRes = await query(
      'SELECT * FROM game_players WHERE id = $1 AND game_id = $2',
      [gamePlayerId, gameId]
    );
    if (playerRes.rows.length === 0) {
      res.status(404).json({ error: 'Player not found in this game' });
      return;
    }
    const player = playerRes.rows[0];

    if (player.status !== 'active') {
      res.status(400).json({ error: 'Player is eliminated' });
      return;
    }

    // Validate fromTile matches actual position
    if (fromTile !== player.current_position) {
      res.status(400).json({ error: 'fromTile does not match your current position' });
      return;
    }

    const nextDay = game.current_day + 1;

    // Check for duplicate move
    const existingMove = await query(
      'SELECT id FROM moves WHERE game_id = $1 AND game_player_id = $2 AND day = $3',
      [gameId, gamePlayerId, nextDay]
    );
    if (existingMove.rows.length > 0) {
      res.status(400).json({ error: 'Move already submitted for this day' });
      return;
    }

    // Validate adjacency
    const boardSize = Math.round(Math.sqrt(game.map_size));
    const adjacent = getAdjacentTiles(fromTile, boardSize);
    if (toTile !== fromTile && !adjacent.includes(toTile)) {
      res.status(400).json({ error: 'Destination tile is not adjacent' });
      return;
    }

    // Validate tile is not blocked
    const tileRes = await query(
      'SELECT * FROM map_tiles WHERE game_id = $1 AND tile_index = $2',
      [gameId, toTile]
    );
    if (tileRes.rows.length > 0) {
      const tileType = tileRes.rows[0].tile_type;
      if (['void', 'water', 'storm', 'wall'].includes(tileType)) {
        res.status(400).json({ error: `Cannot move to ${tileType} tile` });
        return;
      }
    }

    // Build resource check
    if (action === 'build' && buildOption) {
      const cost = BUILD_COSTS[buildOption];
      if (cost) {
        if (player.wood < cost.wood || player.metal < cost.metal) {
          res.status(400).json({ error: 'Not enough resources to build' });
          return;
        }
      }
    }

    // Insert move
    await query(
      `INSERT INTO moves (game_id, game_player_id, day, destination, action, build_option)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [gameId, gamePlayerId, nextDay, toTile, action, buildOption || null]
    );

    // Auto-process day if all alive players have submitted moves
    const alivePlayersRes = await query(
      "SELECT id FROM game_players WHERE game_id = $1 AND status = 'active'",
      [gameId]
    );
    const submittedMovesRes = await query(
      'SELECT DISTINCT game_player_id FROM moves WHERE game_id = $1 AND day = $2 AND processed = FALSE',
      [gameId, nextDay]
    );

    if (submittedMovesRes.rows.length >= alivePlayersRes.rows.length) {
      try {
        await processDay(gameId);
      } catch (processErr: any) {
        console.error('Auto process-day failed:', processErr.message);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
