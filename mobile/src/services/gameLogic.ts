import { Game, GamePlayer, Move, GameEvent, MapTile } from '../types';
import { getAdjacentTiles } from '../store/gameStore';

export interface ResolvedMove extends Move {
  playerName: string;
  playerColor: string;
}

export interface ResolutionResult {
  updatedPlayers: GamePlayer[];
  updatedTiles: MapTile[];
  newEvents: GameEvent[];
  scoutReveals: { targetName: string; action: string }[];
}

const STORM_START_DAY = 5;
const STORM_MIN_TILES = 4;

/**
 * Resolve all submitted moves for a day.
 *
 * Rules:
 * - All moves are simultaneous.
 * - Defenders: if any other player moves to the same destination tile,
 *   the defender is bumped back to their original position.
 *   If the other player was attacking, that attacker is stunned
 *   (can move next turn but cannot perform an action).
 * - Scouts: reveal the chosen action (not destination) of adjacent players.
 * - Stunned players can move but their action is ignored.
 * - Collect on forest -> +1 wood, collect on mountain -> +1 metal.
 * - Storm starts day 5, consumes 1 edge tile per day (non-landmarks first).
 *   Stops when 4 playable tiles remain.
 * - Storm penalty: 1st consecutive day -> next actions revealed to all.
 *   2nd consecutive day -> player dies.
 */
export function resolveMoves(game: Game, moves: ResolvedMove[]): ResolutionResult {
  const events: GameEvent[] = [];
  const day = game.currentDay + 1;
  let eventId = 0;

  const tiles = game.tiles.map((t) => ({ ...t }));
  const players = game.players.map((p) => ({ ...p }));
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const moveMap = new Map(moves.map((m) => [m.playerId, m]));

  // --- 1) Detect collisions with defenders ---
  const byDest = new Map<number, ResolvedMove[]>();
  for (const move of moves) {
    const arr = byDest.get(move.toTile) || [];
    arr.push(move);
    byDest.set(move.toTile, arr);
  }

  const bumpedBack = new Set<string>();
  const stunned = new Set<string>();

  for (const [, tileMoves] of byDest) {
    if (tileMoves.length < 2) continue;
    const defenders = tileMoves.filter((m) => m.action === 'defend');
    const others = tileMoves.filter((m) => m.action !== 'defend');

    if (defenders.length > 0 && others.length > 0) {
      for (const def of defenders) {
        bumpedBack.add(def.playerId);
        events.push({ id: `ev-${day}-${eventId++}`, day, message: `${def.playerName} was defending but got bumped back!`, playerId: def.playerId, playerName: def.playerName, playerColor: def.playerColor });
      }
      for (const other of others) {
        if (other.action === 'attack') {
          stunned.add(other.playerId);
          events.push({ id: `ev-${day}-${eventId++}`, day, message: `${other.playerName} attacked a defender and is stunned!`, playerId: other.playerId, playerName: other.playerName, playerColor: other.playerColor });
        }
      }
    }
  }

  // --- 2) Apply moves ---
  for (const move of moves) {
    const player = playerMap.get(move.playerId);
    if (!player || !player.isAlive) continue;

    if (bumpedBack.has(move.playerId)) {
      // stay
    } else {
      player.position = move.toTile;
    }

    player.isStunned = stunned.has(move.playerId);

    const wasStunned = game.players.find((p) => p.id === move.playerId)?.isStunned;
    if (wasStunned) {
      events.push({ id: `ev-${day}-${eventId++}`, day, message: `${move.playerName} is recovering from stun (no action)`, playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor });
      continue;
    }

    const destTile = tiles[move.toTile];
    switch (move.action) {
      case 'collect':
        if (destTile.type === 'forest') {
          player.wood += 1;
          events.push({ id: `ev-${day}-${eventId++}`, day, message: `${move.playerName} collected wood`, playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor });
        } else if (destTile.type === 'mountain') {
          player.metal += 1;
          events.push({ id: `ev-${day}-${eventId++}`, day, message: `${move.playerName} collected metal`, playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor });
        }
        break;
      case 'attack':
        // Combat resolution handled in step 2b below
        break;
      case 'defend':
        events.push({ id: `ev-${day}-${eventId++}`, day, message: `${move.playerName} defended`, playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor });
        break;
      case 'scout':
        break;
      case 'build':
        events.push({ id: `ev-${day}-${eventId++}`, day, message: `${move.playerName} built something`, playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor });
        break;
    }
  }

  // --- 2b) Attack combat resolution ---
  for (const move of moves) {
    if (move.action !== 'attack') continue;
    const attacker = playerMap.get(move.playerId);
    if (!attacker || !attacker.isAlive) continue;
    const origAttacker = game.players.find((p) => p.id === move.playerId);
    if (origAttacker?.isStunned) continue;

    for (const target of players) {
      if (target.id === attacker.id || !target.isAlive) continue;
      if (target.position !== attacker.position) continue;

      const targetMove = moveMap.get(target.id);
      const targetIsAttacking = targetMove?.action === 'attack';

      if (targetIsAttacking) {
        if (attacker.weaponTier > target.weaponTier) {
          target.isAlive = false;
          events.push({ id: `ev-${day}-${eventId++}`, day, message: `${attacker.name} (tier ${attacker.weaponTier}) eliminated ${target.name} (tier ${target.weaponTier}) in combat!`, playerId: attacker.id, playerName: attacker.name, playerColor: attacker.color });
        } else if (target.weaponTier > attacker.weaponTier) {
          attacker.isAlive = false;
          events.push({ id: `ev-${day}-${eventId++}`, day, message: `${target.name} (tier ${target.weaponTier}) eliminated ${attacker.name} (tier ${attacker.weaponTier}) in combat!`, playerId: target.id, playerName: target.name, playerColor: target.color });
          break;
        } else {
          attacker.isStunned = true;
          target.isStunned = true;
          events.push({ id: `ev-${day}-${eventId++}`, day, message: `${attacker.name} and ${target.name} clashed with equal weapons — both stunned!` });
        }
      } else {
        target.isAlive = false;
        events.push({ id: `ev-${day}-${eventId++}`, day, message: `${attacker.name} eliminated ${target.name}!`, playerId: attacker.id, playerName: attacker.name, playerColor: attacker.color });
      }
    }
  }

  // --- 3) Scout reveals ---
  const scoutReveals: { targetName: string; action: string }[] = [];
  for (const move of moves) {
    if (move.action !== 'scout') continue;
    const player = playerMap.get(move.playerId);
    if (!player) continue;

    const adjacent = getAdjacentTiles(player.position, game.boardSize);
    for (const adjTile of adjacent) {
      for (const other of players) {
        if (other.id === move.playerId || !other.isAlive) continue;
        if (other.position === adjTile) {
          const otherMove = moveMap.get(other.id);
          if (otherMove) {
            scoutReveals.push({ targetName: other.name, action: otherMove.action });
            events.push({ id: `ev-${day}-${eventId++}`, day, message: `${move.playerName} scouted: ${other.name} chose ${otherMove.action}`, playerId: move.playerId, playerName: move.playerName, playerColor: move.playerColor });
          }
        }
      }
    }
  }

  // --- 4) Storm progression ---
  if (day >= STORM_START_DAY) {
    const playableTypes = new Set(['empty', 'forest', 'mountain', 'wall', 'trap']);
    const playableCount = tiles.filter((t) => playableTypes.has(t.type)).length;

    if (playableCount > STORM_MIN_TILES) {
      // Find edge tiles of playable area (adjacent to void/water/storm)
      const edgeTiles = tiles.filter((t) => {
        if (!playableTypes.has(t.type)) return false;
        const neighbors = getAdjacentTiles(t.index, game.boardSize);
        return neighbors.some((n) => {
          const nt = tiles[n];
          return nt && (nt.type === 'void' || nt.type === 'water' || nt.type === 'storm');
        });
      });

      if (edgeTiles.length > 0) {
        // Prioritize non-landmarks (empty first, then landmarks)
        edgeTiles.sort((a, b) => {
          const aLandmark = a.type === 'forest' || a.type === 'mountain' ? 1 : 0;
          const bLandmark = b.type === 'forest' || b.type === 'mountain' ? 1 : 0;
          return aLandmark - bLandmark;
        });

        // Pick the first valid edge tile that maintains connectivity
        for (const candidate of edgeTiles) {
          const testPlayable = new Set(
            tiles.filter((t) => playableTypes.has(t.type) && t.index !== candidate.index).map((t) => t.index)
          );
          if (isStormConnected(testPlayable, game.boardSize)) {
            tiles[candidate.index] = { ...candidate, type: 'storm' };
            events.push({ id: `ev-${day}-${eventId++}`, day, message: `The storm consumed tile ${candidate.index}!` });
            break;
          }
        }
      }
    }
  }

  // --- 5) Storm damage to players ---
  for (const player of players) {
    if (!player.isAlive) continue;
    const tile = tiles[player.position];
    if (tile.type === 'storm') {
      player.daysInStorm += 1;
      if (player.daysInStorm >= 2) {
        player.isAlive = false;
        events.push({ id: `ev-${day}-${eventId++}`, day, message: `${player.name} was consumed by the storm!`, playerId: player.id, playerName: player.name, playerColor: player.color });
      } else {
        player.stormRevealed = true;
        events.push({ id: `ev-${day}-${eventId++}`, day, message: `${player.name} is caught in the storm! Their next action will be revealed.`, playerId: player.id, playerName: player.name, playerColor: player.color });
      }
    } else {
      player.daysInStorm = 0;
      player.stormRevealed = false;
    }
  }

  return { updatedPlayers: players, updatedTiles: tiles, newEvents: events, scoutReveals };
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

export function getValidSpawnTiles(tiles: MapTile[]): number[] {
  return tiles.filter((t) => t.type === 'empty').map((t) => t.index);
}
