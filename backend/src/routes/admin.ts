import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { processDay, getFullGame } from '../services/gameEngine';
import { emitGameUpdate, emitGamesList } from '../socket';

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

const BOT_NAMES = ['Sir Lancelot', 'Shadow Archer', 'Storm Rider', 'Dark Mage', 'Iron Knight', 'Swift Arrow'];
const BOT_CLASSES = ['knight', 'archer', 'cavalry', 'mage'];
const FIGHTER_COLORS = ['red', 'blue', 'yellow', 'purple', 'green'];

// POST /seed-bots — add bot players to a lobby game
router.post('/seed-bots', async (req: Request, res: Response) => {
  try {
    const { gameId, adminSecret, count = 3 } = req.body;

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

    const gameRes = await query('SELECT * FROM games WHERE id = $1', [id]);
    if (gameRes.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    const game = gameRes.rows[0];

    if (game.status !== 'lobby') {
      res.status(400).json({ error: 'Game is not in lobby' });
      return;
    }

    const slotsAvailable = game.max_players - game.current_players;
    const botsToAdd = Math.min(count, slotsAvailable);

    if (botsToAdd <= 0) {
      res.status(400).json({ error: 'Game is already full' });
      return;
    }

    // Get occupied positions
    const occupiedRes = await query(
      'SELECT current_position FROM game_players WHERE game_id = $1',
      [id]
    );
    const occupied = new Set(occupiedRes.rows.map((r: any) => r.current_position));

    // Get available empty tiles
    const tilesRes = await query(
      "SELECT tile_index FROM map_tiles WHERE game_id = $1 AND tile_type = 'empty' ORDER BY tile_index",
      [id]
    );
    const emptyTiles = tilesRes.rows
      .map((r: any) => r.tile_index)
      .filter((idx: number) => !occupied.has(idx));

    // Get existing bot count to avoid name collisions
    const existingBotsRes = await query(
      "SELECT id FROM players WHERE pubkey LIKE 'bot_%'",
      []
    );
    const botOffset = existingBotsRes.rows.length;

    const addedBots = [];

    for (let i = 0; i < botsToAdd; i++) {
      const botName = BOT_NAMES[(botOffset + i) % BOT_NAMES.length];
      const botPubkey = `bot_${Date.now()}_${i}`;
      const botClass = BOT_CLASSES[(botOffset + i) % BOT_CLASSES.length];
      const botColor = FIGHTER_COLORS[(botOffset + i) % FIGHTER_COLORS.length];
      const weaponTier = botClass === 'cavalry' ? 0 : 1;

      // Create bot player
      const botRes = await query(
        `INSERT INTO players (pubkey, username, coins) VALUES ($1, $2, 1000) RETURNING *`,
        [botPubkey, botName]
      );
      const bot = botRes.rows[0];

      await query(
        `INSERT INTO player_stats (player_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [bot.id]
      );

      // Pick spawn position
      const spawnIndex = emptyTiles.length > 0
        ? emptyTiles.splice(Math.floor(Math.random() * emptyTiles.length), 1)[0]
        : null;

      await query(
        `INSERT INTO game_players (game_id, player_id, player_pubkey, display_name, color, fighter_class, weapon_tier, starting_position, current_position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, bot.id, bot.pubkey, bot.username, botColor, botClass, weaponTier, spawnIndex, spawnIndex]
      );

      addedBots.push({ id: bot.id, name: botName, class: botClass });
    }

    // Update player count
    const newCount = game.current_players + botsToAdd;
    await query('UPDATE games SET current_players = $1 WHERE id = $2', [newCount, id]);

    // Auto-start if full
    if (newCount >= game.max_players) {
      await query(
        `UPDATE games SET status = 'active', current_day = 1, started_at = NOW() WHERE id = $1`,
        [id]
      );
      await query(
        `INSERT INTO game_events (game_id, day, event_type, message) VALUES ($1, 1, 'move', 'Game started!')`,
        [id]
      );
    }

    emitGameUpdate(id);
    emitGamesList();

    const updatedGame = await getFullGame(id);
    res.json({ success: true, botsAdded: addedBots, game: updatedGame });
  } catch (err: any) {
    console.error('Admin seed-bots error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
