import { query, pool } from '../config/database';
import { generateMap, randomSpawnPositions, seededRandom } from './mapGenerator';
import { getFullGame } from './gameEngine';
import { emitGameUpdate, emitGamesList } from '../socket';

const PLAYER_COLORS = [
  '#e94560', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
  '#607d8b', '#ffeb3b', '#795548', '#673ab7',
];

const DEFAULT_MAX_PLAYERS = 16;
const DEFAULT_MIN_TO_START = 4;

export async function ensureDefaultLobbyExists(): Promise<void> {
  try {
    const existing = await query(
      `SELECT id FROM games WHERE is_default = TRUE AND status = 'lobby' LIMIT 1`
    );
    if (existing.rows.length > 0) return;

    const deadlineHour = parseInt(process.env.DEFAULT_GAME_DEADLINE_HOUR || '12', 10);
    const validHour = deadlineHour >= 0 && deadlineHour <= 23 ? deadlineHour : 12;

    await query(
      `INSERT INTO games (creator_pubkey, max_players, current_players, map_size, status, move_deadline_utc_hour, is_default, lobby_deadline, map_theme)
       VALUES (NULL, $1, 0, 0, 'lobby', $2, TRUE, NOW() + INTERVAL '1 hour', 'default')`,
      [DEFAULT_MAX_PLAYERS, validHour]
    );

    console.log('Created new default lobby');
    emitGamesList();
  } catch (err) {
    console.error('ensureDefaultLobbyExists failed:', err);
  }
}

export async function processDefaultLobbies(): Promise<void> {
  try {
    const lobbies = await query(
      `SELECT * FROM games WHERE is_default = TRUE AND status = 'lobby' AND lobby_deadline <= NOW()`
    );

    for (const lobby of lobbies.rows) {
      if (lobby.current_players >= DEFAULT_MIN_TO_START) {
        await startDefaultGame(lobby.id);
        await ensureDefaultLobbyExists();
      } else {
        // Extend deadline by 1 hour
        await query(
          `UPDATE games SET lobby_deadline = lobby_deadline + INTERVAL '1 hour' WHERE id = $1`,
          [lobby.id]
        );
      }
    }

    if (lobbies.rows.length > 0) {
      emitGamesList();
    }
  } catch (err) {
    console.error('processDefaultLobbies failed:', err);
  }
}

export async function startDefaultGame(gameId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch all game_players (they have NULL positions in default games)
    const playersRes = await client.query(
      'SELECT * FROM game_players WHERE game_id = $1 ORDER BY id',
      [gameId]
    );
    const playerCount = playersRes.rows.length;
    if (playerCount < 2) {
      await client.query('ROLLBACK');
      return;
    }

    // Generate map
    const seed = Date.now();
    const { tiles, gridSize } = generateMap(playerCount, seed);
    const mapSize = gridSize * gridSize;

    // Insert all map tiles
    for (const tile of tiles) {
      const isTraversable = !['void', 'water', 'storm', 'wall'].includes(tile.type);
      const isLandmark = tile.type === 'forest' || tile.type === 'mountain';
      await client.query(
        `INSERT INTO map_tiles (game_id, tile_index, tile_type, is_traversable, is_landmark)
         VALUES ($1, $2, $3, $4, $5)`,
        [gameId, tile.index, tile.type, isTraversable, isLandmark]
      );
    }

    // Assign spawn positions
    const spawnRand = seededRandom(seed + 1);
    const spawns = randomSpawnPositions(tiles, playerCount, spawnRand);

    for (let i = 0; i < playersRes.rows.length; i++) {
      const gp = playersRes.rows[i];
      const spawnPos = spawns[i] ?? spawns[0];
      await client.query(
        `UPDATE game_players SET starting_position = $1, current_position = $2 WHERE id = $3`,
        [spawnPos, spawnPos, gp.id]
      );
    }

    // Update game to active
    await client.query(
      `UPDATE games SET map_size = $1, status = 'active', current_day = 1, started_at = NOW() WHERE id = $2`,
      [mapSize, gameId]
    );

    // Insert game start event
    await client.query(
      `INSERT INTO game_events (game_id, day, event_type, message) VALUES ($1, 1, 'move', 'Game started!')`,
      [gameId]
    );

    await client.query('COMMIT');

    console.log(`Default game ${gameId} started with ${playerCount} players`);
    emitGameUpdate(gameId);
    emitGamesList();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`startDefaultGame(${gameId}) failed:`, err);
  } finally {
    client.release();
  }
}
