import { getAdjacentTiles, resolveMoves } from '../services/gameEngine';
import { makeBoard, makePlayer, makeTile } from './helpers';
import { ActionType, BuildOption } from '../types';

// Helper to build a ResolvedMove for resolveMoves()
function makeMove(
  player: ReturnType<typeof makePlayer>,
  toTile: number,
  action: ActionType,
  buildOption?: BuildOption | null,
) {
  return {
    playerId: player.id,
    gamePlayerId: parseInt(player.id, 10),
    playerName: player.name,
    playerColor: player.color,
    fromTile: player.position,
    toTile,
    action,
    buildOption: buildOption ?? null,
  };
}

describe('getAdjacentTiles', () => {
  const boardSize = 8;

  it('returns 8 neighbors for a center tile', () => {
    // Tile 27 = (3,3) on 8x8
    const adj = getAdjacentTiles(27, boardSize);
    expect(adj).toHaveLength(8);
    // Should include all 8 directions
    expect(adj.sort((a, b) => a - b)).toEqual([
      18, 19, 20, // row above
      26, 28,     // same row
      34, 35, 36, // row below
    ]);
  });

  it('returns 3 neighbors for a corner tile', () => {
    // Tile 0 = (0,0) — top-left corner
    const adj = getAdjacentTiles(0, boardSize);
    expect(adj).toHaveLength(3);
    expect(adj.sort((a, b) => a - b)).toEqual([1, 8, 9]);
  });

  it('returns 5 neighbors for an edge tile', () => {
    // Tile 1 = (1,0) — top edge, not corner
    const adj = getAdjacentTiles(1, boardSize);
    expect(adj).toHaveLength(5);
    expect(adj.sort((a, b) => a - b)).toEqual([0, 2, 8, 9, 10]);
  });
});

describe('resolveMoves — wall blocking (Bug 1 fix)', () => {
  it('blocks movement to a wall tile', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'wall', 4);

    const p1 = makePlayer({ id: '1', position: 4 });
    const move = makeMove(p1, 5, 'defend');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    // Player should stay at original position
    expect(result.updatedPlayers[0].position).toBe(4);
    expect(result.newEvents.some((e) => e.message.includes('blocked'))).toBe(true);
  });

  it('blocks movement to a storm tile', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'storm', 4);

    const p1 = makePlayer({ id: '1', position: 4 });
    const move = makeMove(p1, 5, 'collect');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedPlayers[0].position).toBe(4);
    expect(result.newEvents.some((e) => e.message.includes('blocked'))).toBe(true);
  });

  it('blocks movement to a void tile', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'void', 4);

    const p1 = makePlayer({ id: '1', position: 4 });
    const move = makeMove(p1, 5, 'defend');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedPlayers[0].position).toBe(4);
  });
});

describe('resolveMoves — normal movement', () => {
  it('moves player to an empty tile', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4 });
    const move = makeMove(p1, 5, 'defend');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedPlayers[0].position).toBe(5);
  });
});

describe('resolveMoves — combat', () => {
  it('attacker eliminates non-attacker', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, weaponTier: 1 });
    const p2 = makePlayer({ id: '2', position: 5, weaponTier: 1, color: '#3498db' });

    const moves = [
      makeMove(p1, 5, 'attack'),
      makeMove(p2, 5, 'collect'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2],
      tiles,
      moves,
    );

    const updated1 = result.updatedPlayers.find((p) => p.id === '1')!;
    const updated2 = result.updatedPlayers.find((p) => p.id === '2')!;
    expect(updated1.isAlive).toBe(true);
    expect(updated2.isAlive).toBe(false);
  });

  it('higher weapon tier wins attacker-vs-attacker', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, weaponTier: 2 });
    const p2 = makePlayer({ id: '2', position: 5, weaponTier: 1, color: '#3498db' });

    const moves = [
      makeMove(p1, 5, 'attack'),
      makeMove(p2, 5, 'attack'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2],
      tiles,
      moves,
    );

    const updated1 = result.updatedPlayers.find((p) => p.id === '1')!;
    const updated2 = result.updatedPlayers.find((p) => p.id === '2')!;
    expect(updated1.isAlive).toBe(true);
    expect(updated2.isAlive).toBe(false);
  });

  it('equal weapon tiers stun both attackers', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, weaponTier: 1 });
    const p2 = makePlayer({ id: '2', position: 5, weaponTier: 1, color: '#3498db' });

    const moves = [
      makeMove(p1, 5, 'attack'),
      makeMove(p2, 5, 'attack'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2],
      tiles,
      moves,
    );

    const updated1 = result.updatedPlayers.find((p) => p.id === '1')!;
    const updated2 = result.updatedPlayers.find((p) => p.id === '2')!;
    expect(updated1.isAlive).toBe(true);
    expect(updated2.isAlive).toBe(true);
    expect(updated1.isStunned).toBe(true);
    expect(updated2.isStunned).toBe(true);
  });
});

describe('resolveMoves — resource collection', () => {
  it('forest gives wood', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'forest', 4);
    const p1 = makePlayer({ id: '1', position: 4, wood: 0 });
    const move = makeMove(p1, 5, 'collect');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedPlayers[0].wood).toBe(1);
    expect(result.newEvents.some((e) => e.message.includes('wood'))).toBe(true);
  });

  it('mountain gives metal', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'mountain', 4);
    const p1 = makePlayer({ id: '1', position: 4, metal: 0 });
    const move = makeMove(p1, 5, 'collect');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedPlayers[0].metal).toBe(1);
  });
});

describe('resolveMoves — building', () => {
  it('wall changes tile type and deducts resources', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, wood: 5, metal: 5 });
    const move = makeMove(p1, 5, 'build', 'wall');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedTiles[5].type).toBe('wall');
    expect(result.updatedPlayers[0].wood).toBe(3); // 5 - 2
    expect(result.updatedPlayers[0].metal).toBe(4); // 5 - 1
  });

  it('trap sets owner', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, wood: 5, metal: 5 });
    const move = makeMove(p1, 5, 'build', 'trap');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedTiles[5].type).toBe('trap');
    expect(result.trapOwners.get(5)).toBe('1');
  });

  it('upgrade increases weapon tier', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, wood: 5, metal: 5, weaponTier: 1 });
    const move = makeMove(p1, 5, 'build', 'upgrade');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    expect(result.updatedPlayers[0].weaponTier).toBe(2);
  });
});

describe('resolveMoves — trap effects', () => {
  it('enemy trap stuns player', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'trap', 4);
    const p1 = makePlayer({ id: '1', position: 4 });
    const trapOwners = new Map<number, string>([[ 5, '99' ]]); // owned by someone else

    const move = makeMove(p1, 5, 'defend');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
      trapOwners,
    );

    expect(result.updatedPlayers[0].isStunned).toBe(true);
    expect(result.updatedTiles[5].type).toBe('empty'); // trap consumed
    expect(result.newEvents.some((e) => e.message.includes('trap'))).toBe(true);
  });

  it('own trap does not stun', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'trap', 4);
    const p1 = makePlayer({ id: '1', position: 4 });
    const trapOwners = new Map<number, string>([[ 5, '1' ]]); // owned by self

    const move = makeMove(p1, 5, 'defend');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
      trapOwners,
    );

    expect(result.updatedPlayers[0].isStunned).toBe(false);
    expect(result.updatedTiles[5].type).toBe('trap'); // trap still there
  });
});

describe('resolveMoves — stun recovery', () => {
  it('stunned player still moves but action is skipped', () => {
    const tiles = makeBoard(4);
    tiles[5] = makeTile(5, 'forest', 4);
    const p1 = makePlayer({ id: '1', position: 4, isStunned: true, wood: 0 });
    const move = makeMove(p1, 5, 'collect');

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1],
      tiles,
      [move],
    );

    // Player should move to tile 5
    expect(result.updatedPlayers[0].position).toBe(5);
    // But should NOT collect (action skipped)
    expect(result.updatedPlayers[0].wood).toBe(0);
    expect(result.newEvents.some((e) => e.message.includes('recovering from stun'))).toBe(true);
  });
});
