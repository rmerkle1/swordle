import { query } from '../config/database';
import { processDay } from './gameEngine';
import { emitGameUpdate, emitGamesList } from '../socket';

// Track which games have already been processed during today's deadline window.
// Maps gameId -> UTC date string ("YYYY-MM-DD") when it was last auto-processed.
const processedToday = new Map<number, string>();

export async function processExpiredDeadlines(): Promise<void> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const todayUTC = now.toISOString().slice(0, 10);

  // Find active games whose deadline hour matches the current UTC hour
  const gamesRes = await query(
    `SELECT id, current_day FROM games WHERE status = 'active' AND move_deadline_utc_hour = $1`,
    [currentHour]
  );

  for (const game of gamesRes.rows) {
    const gameId = game.id;
    const nextDay = game.current_day + 1;

    // Only process each game once per calendar day
    if (processedToday.get(gameId) === todayUTC) continue;

    try {
      // Find alive players who haven't submitted for the next day
      const missingRes = await query(
        `SELECT gp.id, gp.current_position
         FROM game_players gp
         WHERE gp.game_id = $1 AND gp.status = 'active'
           AND gp.id NOT IN (
             SELECT m.game_player_id FROM moves m
             WHERE m.game_id = $1 AND m.day = $2
           )`,
        [gameId, nextDay]
      );

      if (missingRes.rows.length === 0) continue;

      // Auto-insert defend-in-place moves for missing players
      for (const player of missingRes.rows) {
        await query(
          `INSERT INTO moves (game_id, game_player_id, day, destination, action, build_option)
           VALUES ($1, $2, $3, $4, 'defend', NULL)
           ON CONFLICT (game_id, game_player_id, day) DO NOTHING`,
          [gameId, player.id, nextDay, player.current_position]
        );
      }

      // Check if all moves are now submitted
      const aliveCount = await query(
        `SELECT COUNT(*) as count FROM game_players WHERE game_id = $1 AND status = 'active'`,
        [gameId]
      );
      const moveCount = await query(
        `SELECT COUNT(DISTINCT game_player_id) as count FROM moves WHERE game_id = $1 AND day = $2 AND processed = FALSE`,
        [gameId, nextDay]
      );

      if (parseInt(moveCount.rows[0].count, 10) >= parseInt(aliveCount.rows[0].count, 10)) {
        await processDay(gameId);
        emitGameUpdate(gameId);
        emitGamesList();
        processedToday.set(gameId, todayUTC);
        console.log(`Deadline processor: auto-processed day ${nextDay} for game ${gameId}`);
      }
    } catch (err) {
      console.error(`Deadline processor: failed for game ${gameId}:`, err);
    }
  }

  // Cleanup stale entries from previous days
  for (const [id, date] of processedToday) {
    if (date !== todayUTC) processedToday.delete(id);
  }
}
