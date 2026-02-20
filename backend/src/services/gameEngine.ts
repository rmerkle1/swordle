import { query, pool } from '../config/database';
import { Game, GamePlayer, GameEvent, MapTile, TileType, ActionType, BuildOption, FighterClass } from '../types';

function chebyshevDistance(index1: number, index2: number, boardSize: number): number {
  const x1 = index1 % boardSize;
  const y1 = Math.floor(index1 / boardSize);
  const x2 = index2 % boardSize;
  const y2 = Math.floor(index2 / boardSize);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

const STORM_START_DAY = 5;
const STORM_MIN_TILES = 4;

const PLAYER_COLORS = [
  '#e94560', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
  '#607d8b', '#ffeb3b', '#795548', '#673ab7',
];

const BUILD_COSTS: Record<string, { wood: number; metal: number }> = {
  wall: { wood: 2, metal: 1 },
  trap: { wood: 1, metal: 2 },
  upgrade: { wood: 3, metal: 1 },
};

export function getAdjacentTiles(tileIndex: number, boardSize: number): number[] {
  const x = tileIndex % boardSize;
  const y = Math.floor(tileIndex / boardSize);
  const adjacent: number[] = [];

  const dirs = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];

  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
      adjacent.push(ny * boardSize + nx);
    }
  }

  return adjacent;
}

interface ResolvedMove {
  playerId: string;
  gamePlayerId: number;
  playerName: string;
  playerColor: string;
  fromTile: number;
  toTile: number;
  action: ActionType;
  buildOption?: BuildOption | null;
  attackTarget?: number | null;
  fighterClass: FighterClass;
}

interface ResolutionResult {
  updatedPlayers: GamePlayer[];
  updatedTiles: MapTile[];
  newEvents: GameEvent[];
  trapOwners: Map<number, string>;
}

function isStormConnected(playable: Set<number>, boardSize: number): boolean {
  if (playable.size === 0) return true;
  const start = playable.values().next().value!;
  const visited = new Set<number>();
  const queue = [start];
  visited.add(start);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of getAdjacentTiles(cur, boardSize)) {
      if (playable.has(n) && !visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return visited.size === playable.size;
}

export function weightedRandom(contestants: ResolvedMove[], rng: () => number): ResolvedMove {
  const weights = contestants.map(c => c.fighterClass === 'knight' ? 3 : 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < contestants.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return contestants[i];
  }
  return contestants[contestants.length - 1];
}

export function resolveMoves(
  game: { currentDay: number; boardSize: number },
  players: GamePlayer[],
  tiles: MapTile[],
  moves: ResolvedMove[],
  trapOwners: Map<number, string> = new Map(),
  rng: () => number = Math.random
): ResolutionResult {
  const events: GameEvent[] = [];
  const day = game.currentDay + 1;
  let eventId = 0;

  const updatedTiles = tiles.map((t) => ({ ...t }));
  const updatedPlayers = players.map((p) => ({ ...p }));
  const playerMap = new Map(updatedPlayers.map((p) => [p.id, p]));
  const moveMap = new Map(moves.map((m) => [m.playerId, m]));

  // --- 1) Tile Duel Resolution ---
  const byDest = new Map<number, ResolvedMove[]>();
  for (const move of moves) {
    const arr = byDest.get(move.toTile) || [];
    arr.push(move);
    byDest.set(move.toTile, arr);
  }

  const bumpedBack = new Set<string>();
  const eliminated = new Set<string>();
  const stunned = new Set<string>();

  for (const [, tileMoves] of byDest) {
    if (tileMoves.length < 2) continue;
    // Only consider melee classes for tile duels (archer/mage don't melee-attack on destination)
    const attackers = tileMoves.filter((m) => m.action === 'attack' && (m.fighterClass === 'knight' || m.fighterClass === 'cavalry'));
    const nonAttackers = tileMoves.filter((m) => !(m.action === 'attack' && (m.fighterClass === 'knight' || m.fighterClass === 'cavalry')));

    let winner: ResolvedMove;

    if (attackers.length === 1 && nonAttackers.length > 0) {
      // 1 attacker vs others → attacker wins
      winner = attackers[0];
      for (const loser of nonAttackers) {
        eliminated.add(loser.playerId);
        bumpedBack.add(loser.playerId);
        events.push({
          id: `ev-${day}-${eventId++}`, day,
          message: `${winner.playerName} eliminated ${loser.playerName} in a duel!`,
          playerId: winner.playerId, playerName: winner.playerName, playerColor: winner.playerColor,
        });
      }
    } else if (attackers.length >= 2) {
      // Multiple attackers → highest tier wins, equal tier → weighted random
      const maxTier = Math.max(...attackers.map(a => {
        const p = playerMap.get(a.playerId);
        return p ? p.weaponTier : 0;
      }));
      const topAttackers = attackers.filter(a => {
        const p = playerMap.get(a.playerId);
        return p && p.weaponTier === maxTier;
      });

      if (topAttackers.length === 1) {
        winner = topAttackers[0];
      } else {
        winner = weightedRandom(topAttackers, rng);
      }

      // Eliminate all others (attackers who lost + non-attackers)
      for (const m of tileMoves) {
        if (m.playerId === winner.playerId) continue;
        eliminated.add(m.playerId);
        bumpedBack.add(m.playerId);
        events.push({
          id: `ev-${day}-${eventId++}`, day,
          message: `${winner.playerName} eliminated ${m.playerName} in a duel!`,
          playerId: winner.playerId, playerName: winner.playerName, playerColor: winner.playerColor,
        });
      }
    } else {
      // 0 melee attackers → weighted random among all
      winner = weightedRandom(tileMoves, rng);
      for (const m of tileMoves) {
        if (m.playerId === winner.playerId) continue;
        eliminated.add(m.playerId);
        bumpedBack.add(m.playerId);
        events.push({
          id: `ev-${day}-${eventId++}`, day,
          message: `${m.playerName} was eliminated in a collision (${winner.playerName} survived)!`,
          playerId: winner.playerId, playerName: winner.playerName, playerColor: winner.playerColor,
        });
      }
    }
  }

  // --- 1b) Check for blocked destinations (wall/storm/void/water built since submission) ---
  const blockedTileTypes = new Set<string>(['void', 'water', 'storm', 'wall']);
  for (const move of moves) {
    if (bumpedBack.has(move.playerId)) continue;
    const destTile = updatedTiles[move.toTile];
    if (destTile && blockedTileTypes.has(destTile.type)) {
      bumpedBack.add(move.playerId);
      events.push({
        id: `ev-${day}-${eventId++}`, day,
        message: `${move.playerName} can't move to a ${destTile.type} tile — blocked!`,
        playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
      });
    }
  }

  // Mark eliminated players from duel resolution
  for (const pid of eliminated) {
    const player = playerMap.get(pid);
    if (player) player.isAlive = false;
  }

  // --- 2) Apply moves ---
  for (const move of moves) {
    const player = playerMap.get(move.playerId);
    if (!player || !player.isAlive) continue;

    if (bumpedBack.has(move.playerId)) {
      // stay at current position
    } else {
      player.position = move.toTile;
    }

    player.isStunned = stunned.has(move.playerId);

    // Check if player was stunned from previous round
    const originalPlayer = players.find((p) => p.id === move.playerId);
    if (originalPlayer?.isStunned) {
      events.push({
        id: `ev-${day}-${eventId++}`, day,
        message: `${move.playerName} is recovering from stun (no action)`,
        playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
      });
      continue;
    }

    const destTile = updatedTiles[move.toTile];
    switch (move.action) {
      case 'collect':
        if (destTile.type === 'forest') {
          player.wood += 1;
          events.push({
            id: `ev-${day}-${eventId++}`, day,
            message: `${move.playerName} collected wood`,
            playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
          });
        } else if (destTile.type === 'mountain') {
          player.metal += 1;
          events.push({
            id: `ev-${day}-${eventId++}`, day,
            message: `${move.playerName} collected metal`,
            playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
          });
        }
        break;
      case 'attack':
        // Combat resolution handled in step 2b below
        break;
      case 'defend':
        events.push({
          id: `ev-${day}-${eventId++}`, day,
          message: `${move.playerName} defended`,
          playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
        });
        break;
      case 'build':
        if (move.buildOption) {
          const cost = BUILD_COSTS[move.buildOption];
          if (cost && player.wood >= cost.wood && player.metal >= cost.metal) {
            player.wood -= cost.wood;
            player.metal -= cost.metal;
            if (move.buildOption === 'wall') {
              updatedTiles[move.toTile] = { ...destTile, type: 'wall' };
              events.push({
                id: `ev-${day}-${eventId++}`, day,
                message: `${move.playerName} built a wall`,
                playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
              });
            } else if (move.buildOption === 'trap') {
              updatedTiles[move.toTile] = { ...destTile, type: 'trap' };
              trapOwners.set(move.toTile, move.playerId);
              events.push({
                id: `ev-${day}-${eventId++}`, day,
                message: `${move.playerName} placed a trap`,
                playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
              });
            } else if (move.buildOption === 'upgrade') {
              if (player.weaponTier < 4) {
                player.weaponTier += 1;
                events.push({
                  id: `ev-${day}-${eventId++}`, day,
                  message: `${move.playerName} upgraded to weapon tier ${player.weaponTier}`,
                  playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
                });
              }
            }
          }
        }
        break;
      case 'scout':
        break;
    }
  }

  // --- 2a) Trap effects ---
  for (const player of updatedPlayers) {
    if (!player.isAlive) continue;
    const tile = updatedTiles[player.position];
    if (tile.type === 'trap') {
      // Skip if this player owns the trap
      const owner = trapOwners.get(player.position);
      if (owner !== player.id) {
        player.isStunned = true;
        updatedTiles[player.position] = { ...tile, type: 'empty' };
        trapOwners.delete(player.position);
        events.push({
          id: `ev-${day}-${eventId++}`, day,
          message: `${player.name} stepped on a trap and is stunned!`,
          playerId: player.id, playerName: player.name, playerColor: player.color,
        });
      }
    }
  }

  // --- 2b) Ranged Attack Resolution (Archer/Mage) ---
  const rangedMoves = moves.filter(m =>
    m.action === 'attack' && (m.fighterClass === 'archer' || m.fighterClass === 'mage') && m.attackTarget != null
  );

  // Build crossfire pairs first to handle mutual targeting
  const crossfirePairs = new Set<string>();

  for (const move of rangedMoves) {
    const attacker = playerMap.get(move.playerId);
    if (!attacker || !attacker.isAlive) continue;
    const origAttacker = players.find((p) => p.id === move.playerId);
    if (origAttacker?.isStunned) continue;

    // Get target tiles for this attacker
    const attackerTargetTiles: number[] = [];
    if (move.fighterClass === 'archer') {
      attackerTargetTiles.push(move.attackTarget!);
    } else if (move.fighterClass === 'mage') {
      const tl = move.attackTarget!;
      attackerTargetTiles.push(tl, tl + 1, tl + game.boardSize, tl + 1 + game.boardSize);
    }

    // Check for crossfire with other ranged attackers
    for (const other of rangedMoves) {
      if (other.playerId === move.playerId) continue;
      const otherPlayer = playerMap.get(other.playerId);
      if (!otherPlayer || !otherPlayer.isAlive) continue;
      const origOther = players.find((p) => p.id === other.playerId);
      if (origOther?.isStunned) continue;

      // Does this attacker's area cover the other's tile?
      const otherPos = otherPlayer.position;
      if (!attackerTargetTiles.includes(otherPos)) continue;

      // Does the other's area cover this attacker's tile?
      const otherTargetTiles: number[] = [];
      if (other.fighterClass === 'archer') {
        otherTargetTiles.push(other.attackTarget!);
      } else if (other.fighterClass === 'mage') {
        const otl = other.attackTarget!;
        otherTargetTiles.push(otl, otl + 1, otl + game.boardSize, otl + 1 + game.boardSize);
      }

      if (otherTargetTiles.includes(attacker.position)) {
        // Mutual crossfire! Resolve by tier
        const pairKey = [move.playerId, other.playerId].sort().join('-');
        if (crossfirePairs.has(pairKey)) continue;
        crossfirePairs.add(pairKey);

        if (attacker.weaponTier > otherPlayer.weaponTier) {
          otherPlayer.isAlive = false;
          events.push({
            id: `ev-${day}-${eventId++}`, day,
            message: `${attacker.name} outgunned ${otherPlayer.name} in a ranged crossfire!`,
            playerId: attacker.id, playerName: attacker.name, playerColor: attacker.color,
          });
        } else if (otherPlayer.weaponTier > attacker.weaponTier) {
          attacker.isAlive = false;
          events.push({
            id: `ev-${day}-${eventId++}`, day,
            message: `${otherPlayer.name} outgunned ${attacker.name} in a ranged crossfire!`,
            playerId: otherPlayer.id, playerName: otherPlayer.name, playerColor: otherPlayer.color,
          });
        } else {
          // Equal tier → both eliminated
          attacker.isAlive = false;
          otherPlayer.isAlive = false;
          events.push({
            id: `ev-${day}-${eventId++}`, day,
            message: `${attacker.name} and ${otherPlayer.name} eliminated each other in a ranged crossfire!`,
          });
        }
      }
    }
  }

  // Now resolve remaining ranged attacks on non-crossfire targets
  for (const move of rangedMoves) {
    const attacker = playerMap.get(move.playerId);
    if (!attacker || !attacker.isAlive) continue;
    const origAttacker = players.find((p) => p.id === move.playerId);
    if (origAttacker?.isStunned) continue;

    const targetTiles: number[] = [];
    if (move.fighterClass === 'archer') {
      targetTiles.push(move.attackTarget!);
    } else if (move.fighterClass === 'mage') {
      const tl = move.attackTarget!;
      targetTiles.push(tl, tl + 1, tl + game.boardSize, tl + 1 + game.boardSize);
    }

    for (const tileIdx of targetTiles) {
      for (const target of updatedPlayers) {
        if (target.id === attacker.id || !target.isAlive) continue;
        if (target.position !== tileIdx) continue;

        const targetMove = moveMap.get(target.id);
        if (targetMove?.action === 'defend') {
          events.push({
            id: `ev-${day}-${eventId++}`, day,
            message: `${target.name} defended against ${attacker.name}'s ranged attack!`,
            playerId: target.id, playerName: target.name, playerColor: target.color,
          });
        } else {
          target.isAlive = false;
          events.push({
            id: `ev-${day}-${eventId++}`, day,
            message: `${attacker.name} eliminated ${target.name} with a ranged attack!`,
            playerId: attacker.id, playerName: attacker.name, playerColor: attacker.color,
          });
        }
      }
    }
  }

  // --- 3) Scout reveals ---
  for (const move of moves) {
    if (move.action !== 'scout') continue;
    const player = playerMap.get(move.playerId);
    if (!player) continue;

    const adjacent = getAdjacentTiles(player.position, game.boardSize);
    for (const adjTile of adjacent) {
      for (const other of updatedPlayers) {
        if (other.id === move.playerId || !other.isAlive) continue;
        if (other.position === adjTile) {
          const otherMove = moveMap.get(other.id);
          if (otherMove) {
            events.push({
              id: `ev-${day}-${eventId++}`, day,
              message: `${move.playerName} scouted: ${other.name} chose ${otherMove.action}`,
              playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor,
            });
          }
        }
      }
    }
  }

  // --- 4) Storm progression ---
  if (day >= STORM_START_DAY) {
    const playableTypes = new Set<string>(['empty', 'forest', 'mountain', 'wall', 'trap']);
    const playableCount = updatedTiles.filter((t) => playableTypes.has(t.type)).length;

    if (playableCount > STORM_MIN_TILES) {
      const edgeTiles = updatedTiles.filter((t) => {
        if (!playableTypes.has(t.type)) return false;
        const neighbors = getAdjacentTiles(t.index, game.boardSize);
        return neighbors.some((n) => {
          const nt = updatedTiles[n];
          return nt && (nt.type === 'void' || nt.type === 'water' || nt.type === 'storm');
        });
      });

      if (edgeTiles.length > 0) {
        edgeTiles.sort((a, b) => {
          const aLandmark = a.type === 'forest' || a.type === 'mountain' ? 1 : 0;
          const bLandmark = b.type === 'forest' || b.type === 'mountain' ? 1 : 0;
          return aLandmark - bLandmark;
        });

        for (const candidate of edgeTiles) {
          const testPlayable = new Set(
            updatedTiles.filter((t) => playableTypes.has(t.type) && t.index !== candidate.index).map((t) => t.index)
          );
          if (isStormConnected(testPlayable, game.boardSize)) {
            updatedTiles[candidate.index] = { ...candidate, type: 'storm' };
            events.push({ id: `ev-${day}-${eventId++}`, day, message: `The storm consumed tile ${candidate.index}!` });
            break;
          }
        }
      }
    }
  }

  // --- 5) Storm damage to players ---
  for (const player of updatedPlayers) {
    if (!player.isAlive) continue;
    const tile = updatedTiles[player.position];
    if (tile.type === 'storm') {
      player.daysInStorm += 1;
      if (player.daysInStorm >= 2) {
        player.isAlive = false;
        events.push({
          id: `ev-${day}-${eventId++}`, day,
          message: `${player.name} was consumed by the storm!`,
          playerId: player.id, playerName: player.name, playerColor: player.color,
        });
      } else {
        player.stormRevealed = true;
        events.push({
          id: `ev-${day}-${eventId++}`, day,
          message: `${player.name} is caught in the storm! Their next action will be revealed.`,
          playerId: player.id, playerName: player.name, playerColor: player.color,
        });
      }
    } else {
      player.daysInStorm = 0;
      player.stormRevealed = false;
    }
  }

  return { updatedPlayers, updatedTiles, newEvents: events, trapOwners };
}

// --- DB-backed orchestration ---

function toGamePlayer(row: any): GamePlayer {
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    name: row.display_name || row.player_pubkey,
    position: row.current_position,
    color: row.color || PLAYER_COLORS[0],
    wood: row.wood,
    metal: row.metal,
    weaponTier: row.weapon_tier,
    fighterClass: (row.fighter_class as FighterClass) || 'knight',
    isAlive: row.status === 'active',
    isStunned: row.is_stunned,
    daysInStorm: row.days_in_storm,
    stormRevealed: row.storm_revealed,
  };
}

function toMapTile(row: any, boardSize: number): MapTile {
  return {
    index: row.tile_index,
    type: row.tile_type as TileType,
    x: row.x ?? row.tile_index % boardSize,
    y: row.y ?? Math.floor(row.tile_index / boardSize),
  };
}

export async function processDay(gameId: number): Promise<Game> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch game
    const gameRes = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRes.rows.length === 0) throw new Error('Game not found');
    const gameRow = gameRes.rows[0];
    if (gameRow.status !== 'active') throw new Error('Game is not active');

    const boardSize = Math.round(Math.sqrt(gameRow.map_size));
    const currentDay = gameRow.current_day;
    const nextDay = currentDay + 1;

    // Fetch players
    const playersRes = await client.query(
      'SELECT * FROM game_players WHERE game_id = $1 ORDER BY id',
      [gameId]
    );
    const players = playersRes.rows.map(toGamePlayer);
    const playerRowMap = new Map(playersRes.rows.map((r: any) => [String(r.id), r]));

    // Fetch tiles
    const tilesRes = await client.query(
      'SELECT * FROM map_tiles WHERE game_id = $1 ORDER BY tile_index',
      [gameId]
    );
    // Build full tile array indexed by tile_index
    const tileRows = tilesRes.rows;
    const totalTiles = boardSize * boardSize;
    const tiles: MapTile[] = [];
    const tileRowMap = new Map(tileRows.map((r: any) => [r.tile_index as number, r]));
    for (let i = 0; i < totalTiles; i++) {
      const row = tileRowMap.get(i);
      if (row) {
        tiles.push({
          index: row.tile_index,
          type: row.tile_type as TileType,
          x: i % boardSize,
          y: Math.floor(i / boardSize),
        });
      } else {
        tiles.push({ index: i, type: 'void', x: i % boardSize, y: Math.floor(i / boardSize) });
      }
    }

    // Load trap owners
    const trapOwners = new Map<number, string>();
    for (const row of tileRows) {
      if (row.tile_type === 'trap' && row.placed_by_player_id) {
        trapOwners.set(row.tile_index, String(row.placed_by_player_id));
      }
    }

    // Fetch unprocessed moves for this day
    const movesRes = await client.query(
      `SELECT m.*, gp.display_name, gp.color, gp.player_pubkey, gp.fighter_class
       FROM moves m
       JOIN game_players gp ON m.game_player_id = gp.id
       WHERE m.game_id = $1 AND m.day = $2 AND m.processed = FALSE`,
      [gameId, nextDay]
    );

    const resolvedMoves: ResolvedMove[] = movesRes.rows.map((r: any) => ({
      playerId: String(r.game_player_id),
      gamePlayerId: r.game_player_id,
      playerName: r.display_name || r.player_pubkey,
      playerColor: r.color || PLAYER_COLORS[0],
      fromTile: players.find((p) => p.id === String(r.game_player_id))?.position ?? 0,
      toTile: r.destination,
      action: r.action as ActionType,
      buildOption: r.build_option as BuildOption | null,
      attackTarget: r.attack_target ?? null,
      fighterClass: (r.fighter_class as FighterClass) || 'knight',
    }));

    // Resolve
    const result = resolveMoves(
      { currentDay, boardSize },
      players,
      tiles,
      resolvedMoves,
      trapOwners
    );

    // Write back player updates
    for (const player of result.updatedPlayers) {
      await client.query(
        `UPDATE game_players SET
          current_position = $1, wood = $2, metal = $3, weapon_tier = $4,
          status = $5, is_stunned = $6, days_in_storm = $7, storm_revealed = $8,
          last_move_day = $9
        WHERE id = $10`,
        [
          player.position, player.wood, player.metal, player.weaponTier,
          player.isAlive ? 'active' : 'eliminated',
          player.isStunned, player.daysInStorm, player.stormRevealed,
          nextDay, parseInt(player.id, 10),
        ]
      );
      if (!player.isAlive) {
        await client.query(
          'UPDATE game_players SET eliminated_at = NOW() WHERE id = $1 AND eliminated_at IS NULL',
          [parseInt(player.id, 10)]
        );
      }
    }

    // Write back tile updates
    for (const tile of result.updatedTiles) {
      const origRow = tileRowMap.get(tile.index);
      if (origRow && origRow.tile_type !== tile.type) {
        const placedBy = result.trapOwners.get(tile.index) ?? null;
        await client.query(
          'UPDATE map_tiles SET tile_type = $1, is_traversable = $2, placed_by_player_id = $3 WHERE game_id = $4 AND tile_index = $5',
          [tile.type, !['void', 'water', 'storm', 'wall'].includes(tile.type), tile.type === 'trap' ? placedBy : null, gameId, tile.index]
        );
      }
    }

    // Insert events
    for (const event of result.newEvents) {
      const gpId = event.playerId ? parseInt(event.playerId, 10) : null;
      await client.query(
        `INSERT INTO game_events (game_id, day, event_type, message, player_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [gameId, event.day, 'move', event.message, gpId, null]
      );
    }

    // Mark moves processed
    await client.query(
      'UPDATE moves SET processed = TRUE WHERE game_id = $1 AND day = $2',
      [gameId, nextDay]
    );

    // Increment day
    await client.query(
      'UPDATE games SET current_day = $1 WHERE id = $2',
      [nextDay, gameId]
    );

    // Check win condition: only 1 alive player
    const alivePlayers = result.updatedPlayers.filter((p) => p.isAlive);
    let winnerPubkey: string | null = null;
    if (alivePlayers.length <= 1 && result.updatedPlayers.length > 1) {
      const winnerId = alivePlayers.length === 1 ? parseInt(alivePlayers[0].id, 10) : null;
      if (winnerId) {
        const winnerRow = playerRowMap.get(String(winnerId));
        winnerPubkey = winnerRow?.player_pubkey || null;
      }
      await client.query(
        `UPDATE games SET status = 'completed', completed_at = NOW(), winner_pubkey = $1 WHERE id = $2`,
        [winnerPubkey, gameId]
      );

      // Update player_stats for all players in this game
      for (const player of result.updatedPlayers) {
        const gpRow = playerRowMap.get(player.id);
        if (!gpRow) continue;
        const pId = gpRow.player_id;
        const isWinner = alivePlayers.length === 1 && player.id === alivePlayers[0].id;

        // Count how many players this player eliminated
        const elimCount = result.newEvents.filter(
          (e) => e.message?.includes('eliminated') && e.playerId === player.id
        ).length;

        await client.query(
          `UPDATE player_stats SET
            total_games = total_games + 1,
            wins = wins + $1,
            losses = losses + $2,
            eliminations = eliminations + $3,
            win_rate = CASE WHEN (total_games + 1) > 0
              THEN (wins + $1)::FLOAT / (total_games + 1)
              ELSE 0 END
          WHERE player_id = $4`,
          [isWinner ? 1 : 0, isWinner ? 0 : 1, elimCount, pId]
        );
      }
    }

    await client.query('COMMIT');

    // Return updated game state
    return await getFullGame(gameId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getFullGame(gameId: number): Promise<Game> {
  const gameRes = await query('SELECT * FROM games WHERE id = $1', [gameId]);
  if (gameRes.rows.length === 0) throw new Error('Game not found');
  const g = gameRes.rows[0];
  const boardSize = Math.round(Math.sqrt(g.map_size));

  const playersRes = await query(
    'SELECT * FROM game_players WHERE game_id = $1 ORDER BY id',
    [gameId]
  );

  const tilesRes = await query(
    'SELECT * FROM map_tiles WHERE game_id = $1 ORDER BY tile_index',
    [gameId]
  );

  const eventsRes = await query(
    `SELECT ge.*, gp.display_name, gp.color
     FROM game_events ge
     LEFT JOIN game_players gp ON ge.player_id = gp.id
     WHERE ge.game_id = $1 ORDER BY ge.day, ge.id`,
    [gameId]
  );

  const totalTiles = boardSize * boardSize;
  const tileRowMap = new Map(tilesRes.rows.map((r: any) => [r.tile_index as number, r]));
  const tiles: MapTile[] = [];
  for (let i = 0; i < totalTiles; i++) {
    const row = tileRowMap.get(i);
    if (row) {
      tiles.push({ index: row.tile_index, type: row.tile_type as TileType, x: i % boardSize, y: Math.floor(i / boardSize) });
    } else {
      tiles.push({ index: i, type: 'void', x: i % boardSize, y: Math.floor(i / boardSize) });
    }
  }

  const gamePlayers: GamePlayer[] = playersRes.rows.map(toGamePlayer);

  const events: GameEvent[] = eventsRes.rows.map((r: any) => ({
    id: String(r.id),
    day: r.day,
    message: r.message || '',
    playerId: r.player_id ? String(r.player_id) : undefined,
    playerName: r.display_name || undefined,
    playerColor: r.color || undefined,
  }));

  const winnerGpRes = g.winner_pubkey
    ? await query(
        'SELECT id FROM game_players WHERE game_id = $1 AND player_pubkey = $2',
        [gameId, g.winner_pubkey]
      )
    : null;

  return {
    id: String(g.id),
    status: g.status as 'lobby' | 'active' | 'completed',
    currentDay: g.current_day,
    maxPlayers: g.max_players,
    boardSize,
    tiles,
    players: gamePlayers,
    events,
    winner: winnerGpRes && winnerGpRes.rows.length > 0 ? String(winnerGpRes.rows[0].id) : undefined,
    isDefault: g.is_default ?? false,
    currentPlayers: g.current_players ?? 0,
    reservedSlots: g.reserved_slots ?? 0,
    hasPasscode: !!g.passcode,
    lobbyDeadline: g.lobby_deadline ? new Date(g.lobby_deadline).toISOString() : undefined,
    moveDeadlineHour: g.move_deadline_utc_hour ?? 0,
    mapTheme: g.map_theme ?? 'default',
  };
}

export async function getFilteredGame(gameId: number, gamePlayerId?: number): Promise<Game> {
  const game = await getFullGame(gameId);

  // No filtering for non-active games or if no player specified
  if (!gamePlayerId || game.status !== 'active') return game;

  const requester = game.players.find((p) => String(p.id) === String(gamePlayerId));
  // If requester not found or eliminated, return unfiltered (spectator mode)
  if (!requester || !requester.isAlive) return game;

  const myPos = requester.position;

  // Filter player positions: hide players beyond Chebyshev distance 2
  const filteredPlayers = game.players.map((p) => {
    if (p.id === requester.id) return p;
    if (!p.isAlive) return p;
    const dist = chebyshevDistance(p.position, myPos, game.boardSize);
    if (dist > 2) {
      return { ...p, position: -1 };
    }
    return p;
  });

  // Filter tiles: enemy traps outside distance 1 show as 'empty'
  const filteredTiles = game.tiles.map((t) => {
    if (t.type !== 'trap') return t;
    const dist = chebyshevDistance(t.index, myPos, game.boardSize);
    if (dist > 1) {
      return { ...t, type: 'empty' as TileType };
    }
    return t;
  });

  return { ...game, players: filteredPlayers, tiles: filteredTiles };
}
