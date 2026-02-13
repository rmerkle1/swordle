import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { generateMap, randomSpawnPositions, seededRandom } from '../services/mapGenerator';
import { getFullGame } from '../services/gameEngine';
import { Game } from '../types';

const router = Router();

const PLAYER_COLORS = ['#e94560', '#3498db', '#2ecc71', '#f39c12'];

// GET / — list games
router.get('/', async (_req: Request, res: Response) => {
  try {
    const gamesRes = await query('SELECT * FROM games ORDER BY created_at DESC');
    const games: Game[] = [];
    for (const row of gamesRes.rows) {
      const game = await getFullGame(row.id);
      games.push(game);
    }
    res.json(games);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — single game
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }
    const game = await getFullGame(gameId);
    res.json(game);
  } catch (err: any) {
    if (err.message === 'Game not found') {
      res.status(404).json({ error: 'Game not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST / — create game
router.post('/', async (req: Request, res: Response) => {
  try {
    const { maxPlayers = 4, creatorId } = req.body;
    if (!creatorId) {
      res.status(400).json({ error: 'creatorId is required' });
      return;
    }

    // Verify player exists
    const playerRes = await query('SELECT * FROM players WHERE id = $1', [parseInt(creatorId, 10)]);
    if (playerRes.rows.length === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    const player = playerRes.rows[0];

    // Generate map
    const seed = Date.now();
    const { tiles, gridSize } = generateMap(maxPlayers, seed);
    const mapSize = gridSize * gridSize;

    // Create game
    const gameRes = await query(
      `INSERT INTO games (creator_pubkey, max_players, current_players, map_size, status)
       VALUES ($1, $2, 1, $3, 'lobby') RETURNING *`,
      [player.pubkey, maxPlayers, mapSize]
    );
    const gameId = gameRes.rows[0].id;

    // Insert tiles
    for (const tile of tiles) {
      const isTraversable = !['void', 'water', 'storm', 'wall'].includes(tile.type);
      const isLandmark = tile.type === 'forest' || tile.type === 'mountain';
      await query(
        `INSERT INTO map_tiles (game_id, tile_index, tile_type, is_traversable, is_landmark)
         VALUES ($1, $2, $3, $4, $5)`,
        [gameId, tile.index, tile.type, isTraversable, isLandmark]
      );
    }

    // Auto-join creator
    const rand = seededRandom(seed);
    // Need to consume same random calls as generateMap did to get deterministic spawns
    const spawnRand = seededRandom(seed + 1);
    const spawns = randomSpawnPositions(tiles, maxPlayers, spawnRand);
    const spawnPosition = spawns[0];

    await query(
      `INSERT INTO game_players (game_id, player_id, player_pubkey, display_name, color, starting_position, current_position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, player.id, player.pubkey, player.username, PLAYER_COLORS[0], spawnPosition, spawnPosition]
    );

    const game = await getFullGame(gameId);
    res.status(201).json(game);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/join — join a lobby game
router.post('/:id/join', async (req: Request, res: Response) => {
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

    // Fetch game
    const gameRes = await query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRes.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const gameRow = gameRes.rows[0];

    if (gameRow.status !== 'lobby') {
      res.status(400).json({ error: 'Game is not in lobby' });
      return;
    }
    if (gameRow.current_players >= gameRow.max_players) {
      res.status(400).json({ error: 'Game is full' });
      return;
    }

    // Verify player
    const playerRes = await query('SELECT * FROM players WHERE id = $1', [parseInt(playerId, 10)]);
    if (playerRes.rows.length === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    const player = playerRes.rows[0];

    // Check not already joined
    const existingRes = await query(
      'SELECT id FROM game_players WHERE game_id = $1 AND player_id = $2',
      [gameId, player.id]
    );
    if (existingRes.rows.length > 0) {
      res.status(400).json({ error: 'Player already in game' });
      return;
    }

    // Get current player count for color assignment
    const playerIndex = gameRow.current_players;
    const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];

    // Get spawn position: pick from map tiles that aren't occupied
    const tilesRes = await query(
      'SELECT * FROM map_tiles WHERE game_id = $1 ORDER BY tile_index',
      [gameId]
    );
    const occupiedRes = await query(
      'SELECT current_position FROM game_players WHERE game_id = $1',
      [gameId]
    );
    const occupied = new Set(occupiedRes.rows.map((r: any) => r.current_position));

    const emptyTiles = tilesRes.rows.filter(
      (t: any) => t.tile_type === 'empty' && !occupied.has(t.tile_index)
    );

    if (emptyTiles.length === 0) {
      res.status(400).json({ error: 'No available spawn positions' });
      return;
    }

    const spawnTile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];

    await query(
      `INSERT INTO game_players (game_id, player_id, player_pubkey, display_name, color, starting_position, current_position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [gameId, player.id, player.pubkey, player.username, color, spawnTile.tile_index, spawnTile.tile_index]
    );

    const newPlayerCount = gameRow.current_players + 1;
    await query(
      'UPDATE games SET current_players = $1 WHERE id = $2',
      [newPlayerCount, gameId]
    );

    // Auto-start when full
    if (newPlayerCount >= gameRow.max_players) {
      await query(
        `UPDATE games SET status = 'active', current_day = 1, started_at = NOW() WHERE id = $1`,
        [gameId]
      );
      // Insert game start event
      await query(
        `INSERT INTO game_events (game_id, day, event_type, message) VALUES ($1, 1, 'move', 'Game started!')`,
        [gameId]
      );
    }

    const game = await getFullGame(gameId);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/leave — leave a lobby game or forfeit an active game
router.post('/:id/leave', async (req: Request, res: Response) => {
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

    // Fetch game
    const gameRes = await query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRes.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const gameRow = gameRes.rows[0];

    // Find game_player row
    const gpRes = await query(
      'SELECT * FROM game_players WHERE game_id = $1 AND player_id = $2',
      [gameId, parseInt(playerId, 10)]
    );
    if (gpRes.rows.length === 0) {
      res.status(404).json({ error: 'Player not in this game' });
      return;
    }
    const gp = gpRes.rows[0];

    if (gameRow.status === 'lobby') {
      // Remove player from lobby
      await query('DELETE FROM game_players WHERE id = $1', [gp.id]);
      await query(
        'UPDATE games SET current_players = current_players - 1 WHERE id = $1',
        [gameId]
      );
      res.json({ success: true });
    } else if (gameRow.status === 'active') {
      if (gp.status !== 'active') {
        res.status(400).json({ error: 'Player is already eliminated' });
        return;
      }
      // Forfeit — mark player as eliminated
      await query(
        "UPDATE game_players SET status = 'eliminated', eliminated_at = NOW() WHERE id = $1",
        [gp.id]
      );
      // Insert forfeit event
      await query(
        `INSERT INTO game_events (game_id, day, event_type, message, player_id)
         VALUES ($1, $2, 'move', $3, $4)`,
        [gameId, gameRow.current_day, `${gp.display_name} forfeited the game`, gp.id]
      );
      // Check if only 1 player remains — end game
      const aliveRes = await query(
        "SELECT * FROM game_players WHERE game_id = $1 AND status = 'active'",
        [gameId]
      );
      if (aliveRes.rows.length <= 1 && aliveRes.rows.length < gameRow.current_players) {
        const winnerPubkey = aliveRes.rows.length === 1 ? aliveRes.rows[0].player_pubkey : null;
        await query(
          "UPDATE games SET status = 'completed', completed_at = NOW(), winner_pubkey = $1 WHERE id = $2",
          [winnerPubkey, gameId]
        );
      }
      const game = await getFullGame(gameId);
      res.json({ success: true, game });
    } else {
      res.status(400).json({ error: 'Cannot leave a completed game' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
