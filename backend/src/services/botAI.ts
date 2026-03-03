import { query } from '../config/database';
import { getAdjacentTiles } from './gameEngine';
import { FighterClass } from '../types';

const BUILD_COSTS: Record<string, { wood: number; metal: number }> = {
  wall: { wood: 2, metal: 1 },
  trap: { wood: 1, metal: 2 },
  upgrade: { wood: 3, metal: 1 },
};

interface BotPlayer {
  id: number;
  position: number;
  fighterClass: FighterClass;
  weaponTier: number;
  wood: number;
  metal: number;
  isStunned: boolean;
  daysInStorm: number;
}

interface EnemyPlayer {
  id: number;
  position: number;
  weaponTier: number;
  fighterClass: FighterClass;
}

interface BotMove {
  destination: number;
  action: string;
  buildOption: string | null;
  attackTarget: number | null;
}

// ---------------------------------------------------------------------------
// Main exported function — query game state, decide moves, insert into DB
// ---------------------------------------------------------------------------

export async function submitBotMoves(gameId: number): Promise<void> {
  const gameRes = await query('SELECT * FROM games WHERE id = $1', [gameId]);
  if (gameRes.rows.length === 0) return;
  const game = gameRes.rows[0];
  if (game.status !== 'active') return;

  const boardSize = Math.round(Math.sqrt(game.map_size));
  const nextDay = game.current_day + 1;

  // Fetch all active players
  const playersRes = await query(
    `SELECT id, player_pubkey, current_position, fighter_class, weapon_tier,
            wood, metal, is_stunned, days_in_storm
     FROM game_players WHERE game_id = $1 AND status = 'active'`,
    [gameId],
  );

  const bots: any[] = [];
  const enemies: EnemyPlayer[] = [];

  for (const p of playersRes.rows) {
    enemies.push({
      id: p.id,
      position: p.current_position,
      weaponTier: p.weapon_tier,
      fighterClass: p.fighter_class,
    });
    if (p.player_pubkey?.startsWith('bot_')) {
      bots.push(p);
    }
  }

  if (bots.length === 0) return;

  // Which bots already submitted a move this day?
  const existingRes = await query(
    `SELECT game_player_id FROM moves
     WHERE game_id = $1 AND day = $2 AND game_player_id = ANY($3)`,
    [gameId, nextDay, bots.map((b: any) => b.id)],
  );
  const alreadySubmitted = new Set(existingRes.rows.map((r: any) => r.game_player_id));

  // Fetch tile map
  const tilesRes = await query(
    'SELECT tile_index, tile_type FROM map_tiles WHERE game_id = $1',
    [gameId],
  );
  const tileMap = new Map<number, string>();
  for (const r of tilesRes.rows) {
    tileMap.set(r.tile_index, r.tile_type);
  }

  for (const bot of bots) {
    if (alreadySubmitted.has(bot.id)) continue;

    const botPlayer: BotPlayer = {
      id: bot.id,
      position: bot.current_position,
      fighterClass: bot.fighter_class,
      weaponTier: bot.weapon_tier,
      wood: bot.wood,
      metal: bot.metal,
      isStunned: bot.is_stunned,
      daysInStorm: bot.days_in_storm,
    };

    const botEnemies = enemies.filter((e) => e.id !== bot.id);
    const move = decideBotMove(botPlayer, botEnemies, tileMap, boardSize, game.current_day);

    await query(
      `INSERT INTO moves (game_id, game_player_id, day, destination, action, build_option, attack_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (game_id, game_player_id, day) DO NOTHING`,
      [gameId, bot.id, nextDay, move.destination, move.action, move.buildOption, move.attackTarget],
    );
  }
}

// ---------------------------------------------------------------------------
// Pure decision function (no DB)
// ---------------------------------------------------------------------------

export function decideBotMove(
  bot: BotPlayer,
  enemies: EnemyPlayer[],
  tileMap: Map<number, string>,
  boardSize: number,
  currentDay: number,
): BotMove {
  const defendFallback: BotMove = {
    destination: bot.position,
    action: 'defend',
    buildOption: null,
    attackTarget: null,
  };

  // 1. Stunned → defend in place
  if (bot.isStunned) return defendFallback;

  const reachable = getReachableTiles(bot.position, tileMap, boardSize, bot.fighterClass);
  if (reachable.length === 0) return defendFallback;

  // 15% chance to pick a suboptimal random action
  if (Math.random() < 0.15) {
    return randomAction(bot, reachable, tileMap);
  }

  // 2. Storm survival — flee if on storm tile or daysInStorm >= 1
  const currentType = tileMap.get(bot.position) || 'empty';
  if (currentType === 'storm' || bot.daysInStorm >= 1) {
    const safeTiles = reachable.filter((t) => {
      const type = tileMap.get(t) || 'empty';
      return type !== 'storm' && type !== 'void' && type !== 'water';
    });
    if (safeTiles.length > 0) {
      safeTiles.sort((a, b) => distanceToCenter(a, boardSize) - distanceToCenter(b, boardSize));
      return { destination: safeTiles[0], action: 'defend', buildOption: null, attackTarget: null };
    }
  }

  // 3. Storm avoidance (day >= 4) — if adjacent to storm/void, prefer center
  if (currentDay >= 4) {
    const adj = getAdjacentTiles(bot.position, boardSize);
    const nearStorm = adj.some((t) => {
      const type = tileMap.get(t);
      return type === 'storm' || type === 'void';
    });
    if (nearStorm) {
      const centerTiles = reachable.filter(
        (t) => distanceToCenter(t, boardSize) < distanceToCenter(bot.position, boardSize),
      );
      if (centerTiles.length > 0) {
        centerTiles.sort((a, b) => distanceToCenter(a, boardSize) - distanceToCenter(b, boardSize));
        const dest = centerTiles[0];
        const destType = tileMap.get(dest) || 'empty';
        if (destType === 'forest' || destType === 'mountain') {
          return { destination: dest, action: 'collect', buildOption: null, attackTarget: null };
        }
        return { destination: dest, action: 'defend', buildOption: null, attackTarget: null };
      }
    }
  }

  // Shuffle reachable for variety in tiebreaks
  const shuffled = [...reachable].sort(() => Math.random() - 0.5);

  // 4. Attack
  const attackMove = tryAttack(bot, shuffled, enemies, boardSize);
  if (attackMove) return attackMove;

  // 5. Collect resources
  const collectMove = tryCollect(bot, shuffled, tileMap, boardSize);
  if (collectMove) return collectMove;

  // 6. Build
  const buildMove = tryBuild(bot, tileMap);
  if (buildMove) return buildMove;

  // 7. Move toward center
  const centerMove = tryMoveTowardCenter(bot, shuffled, tileMap, boardSize);
  if (centerMove) return centerMove;

  // 8. Defend fallback
  return defendFallback;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReachableTiles(
  pos: number,
  tileMap: Map<number, string>,
  boardSize: number,
  fighterClass: FighterClass,
): number[] {
  const blocked = new Set(['void', 'water', 'storm', 'wall']);
  const adjacent = getAdjacentTiles(pos, boardSize);
  const result = new Set<number>();

  // Current position always reachable (stay in place)
  result.add(pos);

  for (const tile of adjacent) {
    const type = tileMap.get(tile) || 'void';
    if (!blocked.has(type)) result.add(tile);
  }

  // Cavalry: extend to 2-step destinations
  if (fighterClass === 'cavalry') {
    for (const mid of adjacent) {
      const midType = tileMap.get(mid) || 'void';
      if (blocked.has(midType)) continue;
      for (const dest of getAdjacentTiles(mid, boardSize)) {
        if (dest === pos) continue;
        const destType = tileMap.get(dest) || 'void';
        if (!blocked.has(destType)) result.add(dest);
      }
    }
  }

  return Array.from(result);
}

function distanceToCenter(tileIndex: number, boardSize: number): number {
  const x = tileIndex % boardSize;
  const y = Math.floor(tileIndex / boardSize);
  const cx = (boardSize - 1) / 2;
  const cy = (boardSize - 1) / 2;
  return Math.max(Math.abs(x - cx), Math.abs(y - cy));
}

// ---------------------------------------------------------------------------
// Attack logic (class-specific)
// ---------------------------------------------------------------------------

function tryAttack(
  bot: BotPlayer,
  reachable: number[],
  enemies: EnemyPlayer[],
  boardSize: number,
): BotMove | null {
  if (enemies.length === 0) return null;

  switch (bot.fighterClass) {
    case 'knight': {
      // Melee — move onto enemy tile. Favorable when tier >= enemy tier (3x duel weight).
      for (const dest of reachable) {
        const enemy = enemies.find((e) => e.position === dest);
        if (enemy && bot.weaponTier >= enemy.weaponTier) {
          return { destination: dest, action: 'attack', buildOption: null, attackTarget: null };
        }
      }
      return null;
    }

    case 'cavalry': {
      // Melee like knight, but only attack when tier >= 1 (starts at 0)
      if (bot.weaponTier < 1) return null;
      for (const dest of reachable) {
        const enemy = enemies.find((e) => e.position === dest);
        if (enemy && bot.weaponTier >= enemy.weaponTier) {
          return { destination: dest, action: 'attack', buildOption: null, attackTarget: null };
        }
      }
      return null;
    }

    case 'archer': {
      // Ranged — stay 1 tile away, target adjacent tile with enemy
      for (const dest of reachable) {
        // Don't move to a tile with an enemy (would trigger duel)
        if (enemies.some((e) => e.position === dest)) continue;
        const adjToDest = getAdjacentTiles(dest, boardSize);
        for (const adjTile of adjToDest) {
          const enemy = enemies.find((e) => e.position === adjTile);
          if (enemy) {
            return { destination: dest, action: 'attack', buildOption: null, attackTarget: adjTile };
          }
        }
      }
      return null;
    }

    case 'mage': {
      // Ranged 2x2 area — pick area covering most enemies
      let bestMove: BotMove | null = null;
      let bestCount = 0;

      for (const dest of reachable) {
        if (enemies.some((e) => e.position === dest)) continue;
        const target = findBestMageTarget(dest, enemies, boardSize);
        if (target && target.count > bestCount) {
          bestCount = target.count;
          bestMove = {
            destination: dest,
            action: 'attack',
            buildOption: null,
            attackTarget: target.topLeft,
          };
        }
      }
      return bestMove;
    }
  }

  return null;
}

function findBestMageTarget(
  destination: number,
  enemies: EnemyPlayer[],
  boardSize: number,
): { topLeft: number; count: number } | null {
  const totalTiles = boardSize * boardSize;
  const destAdj = getAdjacentTiles(destination, boardSize);

  // Generate candidate top-left positions from tiles adjacent to destination
  const candidates = new Set<number>();
  for (const t of destAdj) {
    candidates.add(t);                     // t is top-left
    candidates.add(t - 1);                 // t is top-right
    candidates.add(t - boardSize);         // t is bottom-left
    candidates.add(t - boardSize - 1);     // t is bottom-right
  }

  let best: { topLeft: number; count: number } | null = null;

  for (const tl of candidates) {
    if (tl < 0 || tl >= totalTiles) continue;
    const tlX = tl % boardSize;
    if (tlX + 1 >= boardSize) continue;
    const tlY = Math.floor(tl / boardSize);
    if (tlY + 1 >= boardSize) continue;

    const area = [tl, tl + 1, tl + boardSize, tl + boardSize + 1];

    // Area must not include destination (mage can't melee)
    if (area.includes(destination)) continue;

    // At least 1 tile in area must be adjacent to destination
    if (!area.some((t) => destAdj.includes(t))) continue;

    const count = enemies.filter((e) => area.includes(e.position)).length;
    if (count > 0 && (!best || count > best.count)) {
      best = { topLeft: tl, count };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Collect resources (class-specific priority)
// ---------------------------------------------------------------------------

function tryCollect(
  bot: BotPlayer,
  reachable: number[],
  tileMap: Map<number, string>,
  boardSize: number,
): BotMove | null {
  const resourceTiles = reachable.filter((t) => {
    const type = tileMap.get(t) || 'void';
    return type === 'forest' || type === 'mountain';
  });
  if (resourceTiles.length === 0) return null;

  let preferred: string;
  switch (bot.fighterClass) {
    case 'knight':  preferred = 'forest'; break;   // slight wood preference
    case 'archer':  preferred = 'mountain'; break;  // metal priority
    case 'cavalry': preferred = 'forest'; break;    // wood priority (upgrades cost 3W 1M)
    case 'mage':    preferred = Math.random() < 0.5 ? 'forest' : 'mountain'; break;
    default:        preferred = 'forest';
  }

  resourceTiles.sort((a, b) => {
    const aType = tileMap.get(a) || 'void';
    const bType = tileMap.get(b) || 'void';
    if (aType === preferred && bType !== preferred) return -1;
    if (bType === preferred && aType !== preferred) return 1;
    return distanceToCenter(a, boardSize) - distanceToCenter(b, boardSize);
  });

  return { destination: resourceTiles[0], action: 'collect', buildOption: null, attackTarget: null };
}

// ---------------------------------------------------------------------------
// Build (class-specific priority)
// ---------------------------------------------------------------------------

function tryBuild(bot: BotPlayer, tileMap: Map<number, string>): BotMove | null {
  const currentType = tileMap.get(bot.position) || 'empty';
  if (['forest', 'mountain', 'water'].includes(currentType)) return null;

  let priorities: string[];
  switch (bot.fighterClass) {
    case 'knight':  priorities = ['wall', 'upgrade']; break;
    case 'archer':  priorities = ['trap', 'upgrade']; break;
    case 'cavalry': priorities = ['upgrade']; break;          // critical — starts tier 0
    case 'mage':    priorities = ['upgrade', 'wall']; break;
    default:        priorities = ['upgrade'];
  }

  for (const option of priorities) {
    if (option === 'upgrade' && bot.weaponTier >= 4) continue;
    const cost = BUILD_COSTS[option];
    if (bot.wood >= cost.wood && bot.metal >= cost.metal) {
      return { destination: bot.position, action: 'build', buildOption: option, attackTarget: null };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Move toward center
// ---------------------------------------------------------------------------

function tryMoveTowardCenter(
  bot: BotPlayer,
  reachable: number[],
  tileMap: Map<number, string>,
  boardSize: number,
): BotMove | null {
  const candidates = reachable.filter((t) => t !== bot.position);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const da = distanceToCenter(a, boardSize);
    const db = distanceToCenter(b, boardSize);
    if (da !== db) return da - db;
    return Math.random() - 0.5; // random tiebreak
  });

  const dest = candidates[0];
  const destType = tileMap.get(dest) || 'empty';
  if (destType === 'forest' || destType === 'mountain') {
    return { destination: dest, action: 'collect', buildOption: null, attackTarget: null };
  }
  return { destination: dest, action: 'defend', buildOption: null, attackTarget: null };
}

// ---------------------------------------------------------------------------
// Random (suboptimal) action — for the 15% randomness factor
// ---------------------------------------------------------------------------

function randomAction(
  bot: BotPlayer,
  reachable: number[],
  tileMap: Map<number, string>,
): BotMove {
  const dest = reachable[Math.floor(Math.random() * reachable.length)];
  const destType = tileMap.get(dest) || 'empty';
  if (destType === 'forest' || destType === 'mountain') {
    return { destination: dest, action: 'collect', buildOption: null, attackTarget: null };
  }
  return { destination: dest, action: 'defend', buildOption: null, attackTarget: null };
}
