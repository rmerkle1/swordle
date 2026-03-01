import { MapTile, GamePlayer, FoggedTile, FoggedPlayer, TileMemoryEntry, TileType } from '../types';
import { TILE_EMOJI } from '../constants/theme';

const LANDMARK_TYPES = new Set<TileType>(['forest', 'mountain', 'water', 'storm']);

function chebyshevDistance(
  index1: number,
  index2: number,
  boardSize: number,
): number {
  const x1 = index1 % boardSize;
  const y1 = Math.floor(index1 / boardSize);
  const x2 = index2 % boardSize;
  const y2 = Math.floor(index2 / boardSize);
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function buildFoggedPlayer(
  player: GamePlayer,
  isSilhouette: boolean,
): FoggedPlayer {
  if (isSilhouette) {
    return {
      isSilhouette: true,
      color: 'red',
      name: '???',
      id: player.id,
      isAlive: player.isAlive,
      fighterClass: player.fighterClass,
    };
  }
  return {
    isSilhouette: false,
    color: player.color,
    name: player.name,
    id: player.id,
    isAlive: player.isAlive,
    fighterClass: player.fighterClass,
  };
}

export function computeFoggedBoard(
  tiles: MapTile[],
  players: GamePlayer[],
  myPlayerId: string,
  myPosition: number,
  boardSize: number,
  currentDay: number,
  tileMemory: Map<number, TileMemoryEntry>,
  myTraps: Set<number>,
  scoutedTraps: Set<number> = new Set(),
): FoggedTile[] {
  const playerMap = new Map<number, GamePlayer>();
  for (const p of players) {
    if (p.isAlive && p.position >= 0) playerMap.set(p.position, p);
  }

  return tiles.map((tile) => {
    if (tile.type === 'void') {
      return {
        index: tile.index,
        visibility: 'hidden' as const,
        displayType: 'void' as TileType,
        displayEmoji: '',
        displayPlayer: null,
      };
    }

    const dist = chebyshevDistance(tile.index, myPosition, boardSize);
    const player = playerMap.get(tile.index) ?? null;

    // Distance 0-1: full visibility
    if (dist <= 1) {
      let displayType = tile.type;
      let displayEmoji = TILE_EMOJI[tile.type];

      // Enemy traps show as empty unless scouted
      if (tile.type === 'trap' && !myTraps.has(tile.index) && !scoutedTraps.has(tile.index)) {
        displayType = 'empty';
        displayEmoji = TILE_EMOJI['empty'];
      }

      return {
        index: tile.index,
        visibility: 'full' as const,
        displayType,
        displayEmoji,
        displayPlayer: player ? buildFoggedPlayer(player, false) : null,
      };
    }

    // Distance 2: partial visibility
    if (dist === 2) {
      const isLandmark = LANDMARK_TYPES.has(tile.type);
      const isScouted = tile.type === 'trap' && scoutedTraps.has(tile.index);
      return {
        index: tile.index,
        visibility: 'partial' as const,
        displayType: isScouted ? 'trap' : (isLandmark ? tile.type : 'empty'),
        displayEmoji: isScouted ? TILE_EMOJI['trap'] : (isLandmark ? TILE_EMOJI[tile.type] : ''),
        displayPlayer: player ? buildFoggedPlayer(player, true) : null,
      };
    }

    // Distance 3+: check memory
    const memory = tileMemory.get(tile.index);
    if (memory && currentDay - memory.lastFullVisibilityDay <= 3) {
      const isScouted = tile.type === 'trap' && scoutedTraps.has(tile.index);
      return {
        index: tile.index,
        visibility: 'fogged' as const,
        displayType: isScouted ? 'trap' : memory.rememberedType,
        displayEmoji: isScouted ? TILE_EMOJI['trap'] : TILE_EMOJI[memory.rememberedType],
        displayPlayer: null,
      };
    }

    // No memory or expired: hidden (void)
    return {
      index: tile.index,
      visibility: 'hidden' as const,
      displayType: 'void' as TileType,
      displayEmoji: '',
      displayPlayer: null,
    };
  });
}
