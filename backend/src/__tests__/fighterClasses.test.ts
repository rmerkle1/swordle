import { resolveMoves, weightedRandom } from '../services/gameEngine';
import { makeBoard, makePlayer, makeTile } from './helpers';
import { ActionType, BuildOption, FighterClass } from '../types';

function makeMove(
  player: ReturnType<typeof makePlayer>,
  toTile: number,
  action: ActionType,
  buildOption?: BuildOption | null,
  extra?: { attackTarget?: number | null; fighterClass?: FighterClass },
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
    attackTarget: extra?.attackTarget ?? null,
    fighterClass: extra?.fighterClass ?? player.fighterClass ?? ('knight' as FighterClass),
  };
}

describe('Tile Duel Resolution', () => {
  it('1 attacker vs 1 non-attacker → attacker wins', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, weaponTier: 1 });
    const p2 = makePlayer({ id: '2', position: 6, weaponTier: 1, color: '#3498db' });

    const moves = [
      makeMove(p1, 5, 'attack'),
      makeMove(p2, 5, 'defend'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(true);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(false);
  });

  it('2 attackers, higher tier wins', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, weaponTier: 2 });
    const p2 = makePlayer({ id: '2', position: 6, weaponTier: 1, color: '#3498db' });

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

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(true);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(false);
  });

  it('2 attackers equal tier → random winner (one eliminated)', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4, weaponTier: 1 });
    const p2 = makePlayer({ id: '2', position: 6, weaponTier: 1, color: '#3498db' });

    const moves = [
      makeMove(p1, 5, 'attack'),
      makeMove(p2, 5, 'attack'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2],
      tiles,
      moves,
      new Map(),
      () => 0.99, // high roll → second contestant wins
    );

    const alive = result.updatedPlayers.filter(p => p.isAlive);
    expect(alive).toHaveLength(1);
  });

  it('0 attackers → random winner', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4 });
    const p2 = makePlayer({ id: '2', position: 6, color: '#3498db' });

    const moves = [
      makeMove(p1, 5, 'defend'),
      makeMove(p2, 5, 'collect'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2],
      tiles,
      moves,
      new Map(),
      () => 0.1,
    );

    const alive = result.updatedPlayers.filter(p => p.isAlive);
    expect(alive).toHaveLength(1);
  });

  it('Knight vs non-Knight random → Knight wins ~75% (weight 3 vs 1)', () => {
    // With deterministic rng at various thresholds, verify weighting
    const tiles = makeBoard(4);

    // Knight weight=3, non-knight weight=1, total=4
    // Knight wins when roll < 3/4 = 0.75
    const knightWins = [0.0, 0.1, 0.5, 0.74].every(rngVal => {
      const p1 = makePlayer({ id: '1', position: 4, fighterClass: 'knight' });
      const p2 = makePlayer({ id: '2', position: 6, color: '#3498db', fighterClass: 'cavalry', weaponTier: 0 });
      const moves = [
        makeMove(p1, 5, 'defend'),
        makeMove(p2, 5, 'defend', null, { fighterClass: 'cavalry' }),
      ];
      const result = resolveMoves(
        { currentDay: 1, boardSize: 4 },
        [p1, p2],
        tiles,
        moves,
        new Map(),
        () => rngVal,
      );
      return result.updatedPlayers.find(p => p.id === '1')!.isAlive;
    });
    expect(knightWins).toBe(true);

    // When roll >= 0.75, non-knight wins
    const p1 = makePlayer({ id: '1', position: 4, fighterClass: 'knight' });
    const p2 = makePlayer({ id: '2', position: 6, color: '#3498db', fighterClass: 'cavalry', weaponTier: 0 });
    const moves = [
      makeMove(p1, 5, 'defend'),
      makeMove(p2, 5, 'defend', null, { fighterClass: 'cavalry' }),
    ];
    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2],
      tiles,
      moves,
      new Map(),
      () => 0.76,
    );
    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(false);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(true);
  });

  it('3-way collision → only 1 survivor', () => {
    const tiles = makeBoard(4);
    const p1 = makePlayer({ id: '1', position: 4 });
    const p2 = makePlayer({ id: '2', position: 6, color: '#3498db' });
    const p3 = makePlayer({ id: '3', position: 1, color: '#2ecc71' });

    const moves = [
      makeMove(p1, 5, 'attack'),
      makeMove(p2, 5, 'defend'),
      makeMove(p3, 5, 'collect'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 4 },
      [p1, p2, p3],
      tiles,
      moves,
    );

    const alive = result.updatedPlayers.filter(p => p.isAlive);
    expect(alive).toHaveLength(1);
    // The attacker should win (1 attacker vs others)
    expect(alive[0].id).toBe('1');
  });
});

describe('Ranged Attack Resolution', () => {
  it('Archer: ranged attack hits enemy on adjacent tile', () => {
    const tiles = makeBoard(8);
    // Archer at position 10, moves to 11, attacks tile 12 where enemy stands
    const archer = makePlayer({ id: '1', position: 10, fighterClass: 'archer' });
    const target = makePlayer({ id: '2', position: 12, color: '#3498db' });

    const moves = [
      makeMove(archer, 11, 'attack', null, { attackTarget: 12, fighterClass: 'archer' }),
      makeMove(target, 12, 'collect'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 8 },
      [archer, target],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(true);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(false);
    expect(result.newEvents.some(e => e.message.includes('ranged attack'))).toBe(true);
  });

  it('Archer: ranged attack negated by defender', () => {
    const tiles = makeBoard(8);
    const archer = makePlayer({ id: '1', position: 10, fighterClass: 'archer' });
    const target = makePlayer({ id: '2', position: 12, color: '#3498db' });

    const moves = [
      makeMove(archer, 11, 'attack', null, { attackTarget: 12, fighterClass: 'archer' }),
      makeMove(target, 12, 'defend'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 8 },
      [archer, target],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(true);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(true);
    expect(result.newEvents.some(e => e.message.includes('defended against'))).toBe(true);
  });

  it('Archer: ranged miss on empty tile → no effect', () => {
    const tiles = makeBoard(8);
    const archer = makePlayer({ id: '1', position: 10, fighterClass: 'archer' });

    const moves = [
      makeMove(archer, 11, 'attack', null, { attackTarget: 12, fighterClass: 'archer' }),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 8 },
      [archer],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(true);
    // No elimination events
    expect(result.newEvents.filter(e => e.message.includes('eliminated'))).toHaveLength(0);
  });

  it('Mage: comet eliminates all enemies in 2x2 area', () => {
    const tiles = makeBoard(8);
    // Mage at 18, moves to 19, attacks top-left 20 (2x2: 20,21,28,29)
    const mage = makePlayer({ id: '1', position: 18, fighterClass: 'mage' });
    const target1 = makePlayer({ id: '2', position: 20, color: '#3498db' });
    const target2 = makePlayer({ id: '3', position: 28, color: '#2ecc71' });

    const moves = [
      makeMove(mage, 19, 'attack', null, { attackTarget: 20, fighterClass: 'mage' }),
      makeMove(target1, 20, 'collect'),
      makeMove(target2, 28, 'collect'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 8 },
      [mage, target1, target2],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(true);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(false);
    expect(result.updatedPlayers.find(p => p.id === '3')!.isAlive).toBe(false);
  });

  it('Mage: comet negated by defender in area', () => {
    const tiles = makeBoard(8);
    const mage = makePlayer({ id: '1', position: 18, fighterClass: 'mage' });
    const target = makePlayer({ id: '2', position: 20, color: '#3498db' });

    const moves = [
      makeMove(mage, 19, 'attack', null, { attackTarget: 20, fighterClass: 'mage' }),
      makeMove(target, 20, 'defend'),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 8 },
      [mage, target],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(true);
    expect(result.newEvents.some(e => e.message.includes('defended against'))).toBe(true);
  });

  it('Cavalry: starts with tier 0', () => {
    const p = makePlayer({ id: '1', fighterClass: 'cavalry', weaponTier: 0 });
    expect(p.weaponTier).toBe(0);
    expect(p.fighterClass).toBe('cavalry');
  });
});

describe('Ranged vs Ranged Crossfire', () => {
  it('higher tier wins crossfire', () => {
    const tiles = makeBoard(8);
    // Archer1 at 10, moves to 11, attacks 20
    // Archer2 at 20, moves to 20, attacks 11
    const a1 = makePlayer({ id: '1', position: 10, fighterClass: 'archer', weaponTier: 2 });
    const a2 = makePlayer({ id: '2', position: 20, fighterClass: 'archer', weaponTier: 1, color: '#3498db' });

    const moves = [
      makeMove(a1, 11, 'attack', null, { attackTarget: 20, fighterClass: 'archer' }),
      makeMove(a2, 20, 'attack', null, { attackTarget: 11, fighterClass: 'archer' }),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 8 },
      [a1, a2],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(true);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(false);
  });

  it('equal tier crossfire → both eliminated', () => {
    const tiles = makeBoard(8);
    const a1 = makePlayer({ id: '1', position: 10, fighterClass: 'archer', weaponTier: 1 });
    const a2 = makePlayer({ id: '2', position: 20, fighterClass: 'archer', weaponTier: 1, color: '#3498db' });

    const moves = [
      makeMove(a1, 11, 'attack', null, { attackTarget: 20, fighterClass: 'archer' }),
      makeMove(a2, 20, 'attack', null, { attackTarget: 11, fighterClass: 'archer' }),
    ];

    const result = resolveMoves(
      { currentDay: 1, boardSize: 8 },
      [a1, a2],
      tiles,
      moves,
    );

    expect(result.updatedPlayers.find(p => p.id === '1')!.isAlive).toBe(false);
    expect(result.updatedPlayers.find(p => p.id === '2')!.isAlive).toBe(false);
  });
});
