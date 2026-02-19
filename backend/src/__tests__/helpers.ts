import { MapTile, GamePlayer, TileType, FighterClass } from '../types';

export function makeTile(index: number, type: TileType = 'empty', boardSize = 8): MapTile {
  return {
    index,
    type,
    x: index % boardSize,
    y: Math.floor(index / boardSize),
  };
}

export function makeBoard(boardSize = 8, defaultType: TileType = 'empty'): MapTile[] {
  const tiles: MapTile[] = [];
  for (let i = 0; i < boardSize * boardSize; i++) {
    tiles.push(makeTile(i, defaultType, boardSize));
  }
  return tiles;
}

export function makePlayer(overrides: Partial<GamePlayer> & { id: string }): GamePlayer {
  return {
    playerId: overrides.playerId ?? `player-${overrides.id}`,
    name: overrides.name ?? `Player ${overrides.id}`,
    position: overrides.position ?? 0,
    color: overrides.color ?? '#e94560',
    wood: overrides.wood ?? 0,
    metal: overrides.metal ?? 0,
    weaponTier: overrides.weaponTier ?? 1,
    fighterClass: overrides.fighterClass ?? 'knight',
    isAlive: overrides.isAlive ?? true,
    isStunned: overrides.isStunned ?? false,
    daysInStorm: overrides.daysInStorm ?? 0,
    stormRevealed: overrides.stormRevealed ?? false,
    ...overrides,
  };
}
