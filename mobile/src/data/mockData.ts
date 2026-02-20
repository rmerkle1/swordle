import { Game, MapTile, GamePlayer, GameEvent, PlayerStats, TileType } from '../types';
import { PLAYER_COLORS } from '../constants/theme';

// --- Seeded random for deterministic maps ---
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// --- Map generation following game rules ---
// Map size = N² playable tiles where N = number of players (4-8)
// N landmarks (half forest, half mountain), not on edges
// N/2 water tiles (seas cluster, rivers chain 1-2), can't split map
// Every playable tile must be adjacent to at least 3 traversable tiles

function getNeighbors8(idx: number, gridW: number, gridH: number): number[] {
  const x = idx % gridW;
  const y = Math.floor(idx / gridW);
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
        result.push(ny * gridW + nx);
      }
    }
  }
  return result;
}

function isConnected(playable: Set<number>, gridW: number, gridH: number): boolean {
  if (playable.size === 0) return true;
  const start = playable.values().next().value!;
  const visited = new Set<number>();
  const queue = [start];
  visited.add(start);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of getNeighbors8(cur, gridW, gridH)) {
      if (playable.has(n) && !visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return visited.size === playable.size;
}

function countTraversableNeighbors(idx: number, playable: Set<number>, gridW: number, gridH: number): number {
  return getNeighbors8(idx, gridW, gridH).filter((n) => playable.has(n)).length;
}

function isEdgeTile(idx: number, playable: Set<number>, gridW: number, gridH: number): boolean {
  return getNeighbors8(idx, gridW, gridH).some((n) => !playable.has(n));
}

function generateMap(playerCount: number, seed: number): { tiles: MapTile[]; gridSize: number } {
  const rand = seededRandom(seed);
  const targetPlayable = playerCount * playerCount;
  // Grid large enough to hold the shape with void border
  const gridSize = Math.ceil(Math.sqrt(targetPlayable)) + 4;
  const total = gridSize * gridSize;
  const cx = (gridSize - 1) / 2;
  const cy = (gridSize - 1) / 2;

  // 1) Grow playable area from center using BFS
  const playable = new Set<number>();
  const centerIdx = Math.floor(cy) * gridSize + Math.floor(cx);
  const candidates = [centerIdx];
  playable.add(centerIdx);

  while (playable.size < targetPlayable && candidates.length > 0) {
    // Pick a random candidate to expand from
    const pickIdx = Math.floor(rand() * candidates.length);
    const cur = candidates[pickIdx];
    candidates.splice(pickIdx, 1);

    const neighbors = getNeighbors8(cur, gridSize, gridSize)
      .filter((n) => !playable.has(n))
      .sort(() => rand() - 0.5);

    for (const n of neighbors) {
      if (playable.size >= targetPlayable) break;
      playable.add(n);
      candidates.push(n);
    }
  }

  // 2) Prune tiles that don't have 3+ traversable neighbors
  let changed = true;
  while (changed) {
    changed = false;
    for (const idx of [...playable]) {
      if (countTraversableNeighbors(idx, playable, gridSize, gridSize) < 3) {
        playable.delete(idx);
        changed = true;
        // Re-add if it breaks connectivity
        if (!isConnected(playable, gridSize, gridSize)) {
          playable.add(idx);
          changed = false;
        }
      }
    }
  }

  // 3) Place water tiles (N/2 total)
  const waterCount = Math.floor(playerCount / 2);
  const waterTiles = new Set<number>();
  const interiorTiles = [...playable].filter((idx) => !isEdgeTile(idx, playable, gridSize, gridSize));

  // Place water as small clusters/chains
  let waterPlaced = 0;
  const waterAttempts = 200;
  for (let attempt = 0; attempt < waterAttempts && waterPlaced < waterCount; attempt++) {
    const candidate = interiorTiles[Math.floor(rand() * interiorTiles.length)];
    if (waterTiles.has(candidate)) continue;

    // Test: would removing this tile break connectivity or violate 3-neighbor rule?
    const testPlayable = new Set(playable);
    testPlayable.delete(candidate);
    if (!isConnected(testPlayable, gridSize, gridSize)) continue;

    // Check all remaining neighbors still have 3+ traversable neighbors
    let valid = true;
    for (const n of getNeighbors8(candidate, gridSize, gridSize)) {
      if (testPlayable.has(n) && countTraversableNeighbors(n, testPlayable, gridSize, gridSize) < 3) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;

    waterTiles.add(candidate);
    playable.delete(candidate);
    waterPlaced++;
  }

  // 4) Place landmarks (N total: half forest, half mountain)
  // Sort by traversable-neighbor count descending so the most interior tiles are picked first.
  // This works even on small maps where binary edge/interior classification fails.
  const landmarkCount = playerCount;
  const forestCount = Math.ceil(landmarkCount / 2);
  const mountainCount = landmarkCount - forestCount;
  const forestTiles = new Set<number>();
  const mountainTiles = new Set<number>();

  const landmarkCandidates = [...playable]
    .map((idx) => ({ idx, neighbors: countTraversableNeighbors(idx, playable, gridSize, gridSize) }))
    .sort((a, b) => {
      // More neighbors = more interior, pick first
      if (b.neighbors !== a.neighbors) return b.neighbors - a.neighbors;
      // Tie-break randomly
      return rand() - 0.5;
    })
    .map((e) => e.idx);

  let fi = 0;
  let mi = 0;
  for (const idx of landmarkCandidates) {
    if (fi < forestCount) {
      forestTiles.add(idx);
      fi++;
    } else if (mi < mountainCount) {
      mountainTiles.add(idx);
      mi++;
    } else {
      break;
    }
  }

  // 5) Build tile array
  const tiles: MapTile[] = [];
  for (let i = 0; i < total; i++) {
    let type: TileType = 'void';
    if (waterTiles.has(i)) type = 'water';
    else if (forestTiles.has(i)) type = 'forest';
    else if (mountainTiles.has(i)) type = 'mountain';
    else if (playable.has(i)) type = 'empty';
    tiles.push({ index: i, type, x: i % gridSize, y: Math.floor(i / gridSize) });
  }

  return { tiles, gridSize };
}

// --- Spawn positions: random empty tiles ---
function randomSpawnPositions(tiles: MapTile[], count: number, rand: () => number): number[] {
  const emptyIndices = tiles.filter((t) => t.type === 'empty').map((t) => t.index);
  const positions: number[] = [];
  const used = new Set<number>();
  while (positions.length < count && positions.length < emptyIndices.length) {
    const idx = emptyIndices[Math.floor(rand() * emptyIndices.length)];
    if (!used.has(idx)) {
      used.add(idx);
      positions.push(idx);
    }
  }
  return positions;
}

// --- Generate mock games ---
const PLAYER_COUNT = 4;
const rand = seededRandom(42);
const { tiles: board, gridSize } = generateMap(PLAYER_COUNT, 42);
const spawns = randomSpawnPositions(board, PLAYER_COUNT, rand);

const mockPlayers: GamePlayer[] = [
  { id: 'player-1', playerId: 'player-1', name: 'You', position: spawns[0], color: PLAYER_COLORS[0], wood: 2, metal: 1, weaponTier: 1, fighterClass: 'knight', isAlive: true, isStunned: false, daysInStorm: 0, stormRevealed: false },
  { id: 'player-2', playerId: 'player-2', name: 'Knight42', position: spawns[1], color: PLAYER_COLORS[1], wood: 1, metal: 0, weaponTier: 1, fighterClass: 'knight', isAlive: true, isStunned: false, daysInStorm: 0, stormRevealed: false },
  { id: 'player-3', playerId: 'player-3', name: 'DragonSlyr', position: spawns[2], color: PLAYER_COLORS[2], wood: 0, metal: 2, weaponTier: 1, fighterClass: 'knight', isAlive: true, isStunned: false, daysInStorm: 0, stormRevealed: false },
  { id: 'player-4', playerId: 'player-4', name: 'SwordMstr', position: spawns[3], color: PLAYER_COLORS[3], wood: 3, metal: 1, weaponTier: 2, fighterClass: 'knight', isAlive: true, isStunned: false, daysInStorm: 0, stormRevealed: false },
];

const mockEvents: GameEvent[] = [
  { id: 'e1', day: 1, message: 'Game started!' },
];

export const MOCK_GAMES: Game[] = [
  {
    id: 'game-1',
    status: 'active',
    currentDay: 3,
    maxPlayers: PLAYER_COUNT,
    boardSize: gridSize,
    tiles: board,
    players: mockPlayers,
    events: mockEvents,
    isDefault: false,
    currentPlayers: PLAYER_COUNT,
    reservedSlots: 0,
    hasPasscode: false,
    moveDeadlineHour: 0,
    mapTheme: 'default',
  },
  {
    id: 'game-2',
    status: 'lobby',
    currentDay: 0,
    maxPlayers: PLAYER_COUNT,
    boardSize: gridSize,
    tiles: board,
    players: [mockPlayers[0], mockPlayers[1]],
    events: [],
    isDefault: false,
    currentPlayers: 2,
    reservedSlots: 0,
    hasPasscode: false,
    moveDeadlineHour: 0,
    mapTheme: 'default',
  },
  {
    id: 'game-3',
    status: 'completed',
    currentDay: 12,
    maxPlayers: PLAYER_COUNT,
    boardSize: gridSize,
    tiles: board,
    players: mockPlayers.map((p, i) => ({ ...p, isAlive: i === 0 })),
    events: [{ id: 'e6', day: 12, message: 'You won the game!', playerId: 'player-1', playerName: 'You', playerColor: PLAYER_COLORS[0] }],
    winner: 'player-1',
    isDefault: false,
    currentPlayers: PLAYER_COUNT,
    reservedSlots: 0,
    hasPasscode: false,
    moveDeadlineHour: 0,
    mapTheme: 'default',
  },
];

export const MOCK_PLAYER_STATS: PlayerStats = {
  gamesPlayed: 15,
  wins: 6,
  winRate: 0.4,
  eliminations: 23,
};

export const TEST_PLAYER_ID = 'player-1';
export const TEST_PLAYER_NAME = 'You';
