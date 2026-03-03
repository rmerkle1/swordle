import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { getAdjacentTiles, processDay, getFullGame } from '../services/gameEngine';
import { submitBotMoves } from '../services/botAI';
import { emitGameUpdate, emitGamesList } from '../socket';

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
  attackTarget: z.number().int().min(0).nullable().optional(),
});

// GET /pending/:playerId — check if player has a pending move for this day
router.get('/pending/:playerId', async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id, 10);
    const gamePlayerId = parseInt(req.params.playerId, 10);
    if (isNaN(gameId) || isNaN(gamePlayerId)) {
      res.status(400).json({ error: 'Invalid IDs' });
      return;
    }

    const gameRes = await query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRes.rows.length === 0) {
      res.json({ pendingMove: null });
      return;
    }
    const game = gameRes.rows[0];
    const nextDay = game.current_day + 1;

    const moveRes = await query(
      'SELECT destination, action, build_option, attack_target FROM moves WHERE game_id = $1 AND game_player_id = $2 AND day = $3 AND processed = FALSE',
      [gameId, gamePlayerId, nextDay]
    );

    if (moveRes.rows.length === 0) {
      res.json({ pendingMove: null });
      return;
    }

    const row = moveRes.rows[0];
    res.json({
      pendingMove: {
        toTile: row.destination,
        action: row.action,
        buildOption: row.build_option || null,
        attackTarget: row.attack_target ?? null,
        day: game.current_day,
      },
    });
  } catch (err: any) {
    console.error('Moves route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE / — retract a pending move (mounted at /api/games/:id/moves)
router.delete('/', async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const { playerId } = req.body;
    if (!playerId) {
      res.status(400).json({ error: 'playerId is required' });
      return;
    }

    const gamePlayerId = parseInt(playerId, 10);
    if (isNaN(gamePlayerId)) {
      res.status(400).json({ error: 'Invalid player ID' });
      return;
    }

    // Validate game is active
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

    // Validate player exists and is active
    const playerRes = await query(
      'SELECT * FROM game_players WHERE id = $1 AND game_id = $2',
      [gamePlayerId, gameId]
    );
    if (playerRes.rows.length === 0) {
      res.status(404).json({ error: 'Player not found in this game' });
      return;
    }
    if (playerRes.rows[0].status !== 'active') {
      res.status(400).json({ error: 'Player is eliminated' });
      return;
    }

    const nextDay = game.current_day + 1;

    // Find unprocessed move
    const moveRes = await query(
      'SELECT id FROM moves WHERE game_id = $1 AND game_player_id = $2 AND day = $3 AND processed = FALSE',
      [gameId, gamePlayerId, nextDay]
    );
    if (moveRes.rows.length === 0) {
      res.status(404).json({ error: 'No pending move found' });
      return;
    }

    await query('DELETE FROM moves WHERE id = $1', [moveRes.rows[0].id]);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Moves route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
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
    const { playerId, fromTile, toTile, action, buildOption, attackTarget } = parsed.data;

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
    const fighterClass = player.fighter_class;

    // Cavalry: allow Chebyshev distance 2 via two-step path
    if (fighterClass === 'cavalry' && toTile !== fromTile && !adjacent.includes(toTile)) {
      const tilesForPathRes = await query(
        'SELECT tile_index, tile_type FROM map_tiles WHERE game_id = $1',
        [gameId]
      );
      const tileTypeMap = new Map(tilesForPathRes.rows.map((r: any) => [r.tile_index as number, r.tile_type as string]));
      const blockedPathTypes = new Set(['void', 'water', 'storm', 'wall']);
      const intermediates = getAdjacentTiles(fromTile, boardSize);
      const reachable = intermediates.some(mid => {
        const midType = tileTypeMap.get(mid);
        if (midType && blockedPathTypes.has(midType)) return false;
        return getAdjacentTiles(mid, boardSize).includes(toTile);
      });
      if (!reachable) {
        res.status(400).json({ error: 'Destination not reachable in 2 steps' });
        return;
      }
    } else if (toTile !== fromTile && !adjacent.includes(toTile)) {
      res.status(400).json({ error: 'Destination tile is not adjacent' });
      return;
    }

    // Archer: attackTarget must be adjacent to destination, not the destination itself
    if (fighterClass === 'archer' && action === 'attack') {
      if (attackTarget == null) {
        res.status(400).json({ error: 'Archer must specify attackTarget' });
        return;
      }
      if (attackTarget === toTile) {
        res.status(400).json({ error: 'Archer cannot melee — target must differ from destination' });
        return;
      }
      if (!getAdjacentTiles(toTile, boardSize).includes(attackTarget)) {
        res.status(400).json({ error: 'attackTarget must be adjacent to destination' });
        return;
      }
    }

    // Mage: attackTarget (top-left of 2x2), at least 1 tile adjacent to destination
    if (fighterClass === 'mage' && action === 'attack') {
      if (attackTarget == null) {
        res.status(400).json({ error: 'Mage must specify attackTarget' });
        return;
      }
      const tl = attackTarget;
      const tr = tl + 1;
      const bl = tl + boardSize;
      const br = bl + 1;
      const area = [tl, tr, bl, br];
      const totalTiles = boardSize * boardSize;
      // Validate all 4 tiles exist on board
      const tlX = tl % boardSize;
      if (tlX + 1 >= boardSize || tl < 0 || br >= totalTiles) {
        res.status(400).json({ error: 'Mage attack area extends off the board' });
        return;
      }
      if (area.includes(toTile)) {
        res.status(400).json({ error: 'Mage cannot melee' });
        return;
      }
      // Validate at least 1 of the 4 is adjacent to toTile (Chebyshev ≤ 1)
      const destAdj = getAdjacentTiles(toTile, boardSize);
      const hasAdjacentTile = area.some(t => destAdj.includes(t) || t === toTile);
      if (!hasAdjacentTile) {
        res.status(400).json({ error: 'Mage attack area must be adjacent to destination' });
        return;
      }
    }

    // Validate tile is not blocked
    const tileRes = await query(
      'SELECT * FROM map_tiles WHERE game_id = $1 AND tile_index = $2',
      [gameId, toTile]
    );
    if (tileRes.rows.length > 0) {
      const tileType = tileRes.rows[0].tile_type;
      if (['void', 'water', 'storm'].includes(tileType)) {
        res.status(400).json({ error: `Cannot move to ${tileType} tile` });
        return;
      }
      if (tileType === 'wall' && action !== 'attack') {
        res.status(400).json({ error: 'Can only attack wall tiles' });
        return;
      }
    }

    // Block build on landmark tiles
    if (action === 'build' && tileRes.rows.length > 0) {
      const tileType = tileRes.rows[0].tile_type;
      if (['forest', 'mountain', 'water'].includes(tileType)) {
        res.status(400).json({ error: `Cannot build on ${tileType} tile` });
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
    try {
      await query(
        `INSERT INTO moves (game_id, game_player_id, day, destination, action, build_option, attack_target)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [gameId, gamePlayerId, nextDay, toTile, action, buildOption || null, attackTarget ?? null]
      );
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(400).json({ error: 'Move already submitted for this day' });
        return;
      }
      throw err;
    }

    // Submit AI moves for all bots in this game
    try {
      await submitBotMoves(gameId);
    } catch (botErr: any) {
      console.error('Bot AI submission failed:', botErr.message);
    }

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
        emitGameUpdate(gameId);
        emitGamesList();
      } catch (processErr: any) {
        console.error('Auto process-day failed:', processErr.message);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Moves route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
