import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { generateMap, randomSpawnPositions, seededRandom } from '../services/mapGenerator';
import { getFullGame, getFilteredGame } from '../services/gameEngine';
import { startDefaultGame, ensureDefaultLobbyExists } from '../services/defaultGameManager';
import { Game } from '../types';
import { emitGameUpdate, emitGamesList } from '../socket';

const router = Router();

const PLAYER_COLORS = [
  '#e94560', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
  '#607d8b', '#ffeb3b', '#795548', '#673ab7',
];

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
    console.error('Games route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — single game (optional ?playerId=X for fog-of-war filtering)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }
    const playerIdParam = req.query.playerId ? parseInt(String(req.query.playerId), 10) : undefined;
    const game = playerIdParam ? await getFilteredGame(gameId, playerIdParam) : await getFullGame(gameId);
    res.json(game);
  } catch (err: any) {
    if (err.message === 'Game not found') {
      res.status(404).json({ error: 'Game not found' });
    } else {
      console.error('Games route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
    }
  }
});

const EXTRA_GAME_COST = 50;

async function checkAndDeductCoins(playerId: number): Promise<{ coinCost: number; coinsRemaining: number } | { error: string; required: number; have: number }> {
  const playerRes = await query('SELECT coins, last_game_date, games_today FROM players WHERE id = $1', [playerId]);
  if (playerRes.rows.length === 0) return { error: 'Player not found', required: 0, have: 0 };
  const p = playerRes.rows[0];

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = p.last_game_date instanceof Date
    ? p.last_game_date.toISOString().slice(0, 10)
    : p.last_game_date;
  const isNewDay = lastDate !== today;
  const gamesToday = isNewDay ? 0 : p.games_today;
  const coinCost = gamesToday === 0 ? 0 : EXTRA_GAME_COST;

  if (coinCost > 0 && p.coins < coinCost) {
    return { error: 'Insufficient coins', required: coinCost, have: p.coins };
  }

  await query(
    `UPDATE players SET coins = coins - $1, last_game_date = $2, games_today = $3 WHERE id = $4`,
    [coinCost, today, gamesToday + 1, playerId]
  );

  return { coinCost, coinsRemaining: p.coins - coinCost };
}

// POST / — create game
router.post('/', async (req: Request, res: Response) => {
  try {
    const { maxPlayers = 4, creatorId, moveDeadlineHour, fighterClass: rawClass, passcode, reservedSlots = 0, mapTheme = 'default' } = req.body;
    if (!creatorId) {
      res.status(400).json({ error: 'creatorId is required' });
      return;
    }

    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 16) {
      res.status(400).json({ error: 'maxPlayers must be between 2 and 16' });
      return;
    }

    const validReserved = Number.isInteger(reservedSlots) && reservedSlots >= 0 && reservedSlots < maxPlayers ? reservedSlots : 0;
    if (validReserved > 0 && !passcode) {
      res.status(400).json({ error: 'Passcode is required when reserving slots' });
      return;
    }

    // Validate fighter class
    const validClasses = ['knight', 'archer', 'cavalry', 'mage'];
    const fighterClass = rawClass && validClasses.includes(rawClass) ? rawClass : 'knight';
    const weaponTier = fighterClass === 'cavalry' ? 0 : 1;

    // Verify player exists
    const playerRes = await query('SELECT * FROM players WHERE id = $1', [parseInt(creatorId, 10)]);
    if (playerRes.rows.length === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    const player = playerRes.rows[0];

    // Coin check
    const coinResult = await checkAndDeductCoins(player.id);
    if ('error' in coinResult) {
      res.status(400).json(coinResult);
      return;
    }

    // Generate map
    const seed = Date.now();
    const { tiles, gridSize } = generateMap(maxPlayers, seed);
    const mapSize = gridSize * gridSize;

    // Validate deadline hour
    const deadlineHour = moveDeadlineHour != null ? parseInt(moveDeadlineHour, 10) : 0;
    const validDeadline = !isNaN(deadlineHour) && deadlineHour >= 0 && deadlineHour <= 23 ? deadlineHour : 0;

    // Create game
    const gameRes = await query(
      `INSERT INTO games (creator_pubkey, max_players, current_players, map_size, status, move_deadline_utc_hour, is_default, passcode, reserved_slots, map_theme)
       VALUES ($1, $2, 1, $3, 'lobby', $4, FALSE, $5, $6, $7) RETURNING *`,
      [player.pubkey, maxPlayers, mapSize, validDeadline, passcode || null, validReserved, mapTheme]
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
    const spawnRand = seededRandom(seed + 1);
    const spawns = randomSpawnPositions(tiles, maxPlayers, spawnRand);
    const spawnPosition = spawns[0];

    await query(
      `INSERT INTO game_players (game_id, player_id, player_pubkey, display_name, color, fighter_class, weapon_tier, starting_position, current_position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [gameId, player.id, player.pubkey, player.username, PLAYER_COLORS[0], fighterClass, weaponTier, spawnPosition, spawnPosition]
    );

    const game = await getFullGame(gameId);
    emitGamesList();
    res.status(201).json({ ...game, coinCost: coinResult.coinCost, coinsRemaining: coinResult.coinsRemaining });
  } catch (err: any) {
    console.error('Games route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
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

    const { playerId, fighterClass: rawClass, passcode: joinPasscode } = req.body;
    if (!playerId) {
      res.status(400).json({ error: 'playerId is required' });
      return;
    }

    // Validate fighter class
    const validClasses = ['knight', 'archer', 'cavalry', 'mage'];
    const fighterClass = rawClass || 'knight';
    if (!validClasses.includes(fighterClass)) {
      res.status(400).json({ error: 'Invalid fighter class' });
      return;
    }

    // Set weapon_tier based on class
    const weaponTier = fighterClass === 'cavalry' ? 0 : 1;

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

    // Passcode check for reserved slots
    if (gameRow.passcode && gameRow.reserved_slots > 0) {
      const openSlots = gameRow.max_players - gameRow.reserved_slots;
      if (gameRow.current_players >= openSlots) {
        if (!joinPasscode || joinPasscode !== gameRow.passcode) {
          res.status(403).json({ error: 'Passcode required for reserved slot' });
          return;
        }
      }
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

    // Coin check
    const coinResult = await checkAndDeductCoins(player.id);
    if ('error' in coinResult) {
      res.status(400).json(coinResult);
      return;
    }

    // Get current player count for color assignment
    const playerIndex = gameRow.current_players;
    const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];

    const isDefault = gameRow.is_default === true;

    if (isDefault) {
      // Default game: no map yet, insert with NULL positions
      await query(
        `INSERT INTO game_players (game_id, player_id, player_pubkey, display_name, color, fighter_class, weapon_tier, starting_position, current_position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL)`,
        [gameId, player.id, player.pubkey, player.username, color, fighterClass, weaponTier]
      );
    } else {
      // Custom game: pick spawn from existing map tiles
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
        `INSERT INTO game_players (game_id, player_id, player_pubkey, display_name, color, fighter_class, weapon_tier, starting_position, current_position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [gameId, player.id, player.pubkey, player.username, color, fighterClass, weaponTier, spawnTile.tile_index, spawnTile.tile_index]
      );
    }

    const newPlayerCount = gameRow.current_players + 1;
    await query(
      'UPDATE games SET current_players = $1 WHERE id = $2',
      [newPlayerCount, gameId]
    );

    if (isDefault && newPlayerCount >= gameRow.max_players) {
      // Default game full — start immediately and create new lobby
      await startDefaultGame(gameId);
      await ensureDefaultLobbyExists();
    } else if (!isDefault && newPlayerCount >= gameRow.max_players) {
      // Custom game full — auto-start
      await query(
        `UPDATE games SET status = 'active', current_day = 1, started_at = NOW() WHERE id = $1`,
        [gameId]
      );
      await query(
        `INSERT INTO game_events (game_id, day, event_type, message) VALUES ($1, 1, 'move', 'Game started!')`,
        [gameId]
      );
    }

    const game = await getFullGame(gameId);
    emitGameUpdate(gameId);
    emitGamesList();
    res.json({ success: true, game, coinCost: coinResult.coinCost, coinsRemaining: coinResult.coinsRemaining });
  } catch (err: any) {
    console.error('Games route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
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
      emitGameUpdate(gameId);
      emitGamesList();
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
      emitGameUpdate(gameId);
      emitGamesList();
      res.json({ success: true, game });
    } else {
      res.status(400).json({ error: 'Cannot leave a completed game' });
    }
  } catch (err: any) {
    console.error('Games route error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
