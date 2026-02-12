import { create } from 'zustand';
import { Game, ActionType, BuildOption, TileMemoryEntry, MapTile } from '../types';
import { BOARD_SIZE } from '../constants/theme';

interface GameState {
  games: Game[];
  currentGame: Game | null;
  selectedTile: number | null;
  pendingAction: ActionType | null;
  buildOption: BuildOption | null;
  isSubmitting: boolean;
  showBanner: boolean;
  tileMemory: Map<number, TileMemoryEntry>;
  myTraps: Set<number>;

  setGames: (games: Game[]) => void;
  setCurrentGame: (game: Game | null) => void;
  selectTile: (tileIndex: number | null) => void;
  setPendingAction: (action: ActionType | null) => void;
  setBuildOption: (option: BuildOption | null) => void;
  setSubmitting: (val: boolean) => void;
  setShowBanner: (val: boolean) => void;
  resetMove: () => void;
  updateTileMemory: (position: number, boardSize: number, tiles: MapTile[], currentDay: number) => void;
  addMyTrap: (tileIndex: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  games: [],
  currentGame: null,
  selectedTile: null,
  pendingAction: null,
  buildOption: null,
  isSubmitting: false,
  showBanner: false,
  tileMemory: new Map(),
  myTraps: new Set(),

  setGames: (games) => set({ games }),
  setCurrentGame: (game) => set({
    currentGame: game,
    selectedTile: null,
    pendingAction: null,
    buildOption: null,
    tileMemory: new Map(),
    myTraps: new Set(),
  }),
  selectTile: (tileIndex) => set({ selectedTile: tileIndex, pendingAction: null, buildOption: null }),
  setPendingAction: (action) => set({ pendingAction: action, buildOption: action === 'build' ? null : null }),
  setBuildOption: (option) => set({ buildOption: option }),
  setSubmitting: (val) => set({ isSubmitting: val }),
  setShowBanner: (val) => set({ showBanner: val }),
  resetMove: () => set({ selectedTile: null, pendingAction: null, buildOption: null }),
  updateTileMemory: (position, boardSize, tiles, currentDay) =>
    set((state) => {
      const newMemory = new Map(state.tileMemory);
      const adjacent = getAdjacentTiles(position, boardSize);
      const nearbyIndices = [position, ...adjacent];
      for (const idx of nearbyIndices) {
        const tile = tiles[idx];
        if (tile && tile.type !== 'void') {
          newMemory.set(idx, {
            tileIndex: idx,
            lastFullVisibilityDay: currentDay,
            rememberedType: tile.type,
          });
        }
      }
      return { tileMemory: newMemory };
    }),
  addMyTrap: (tileIndex) =>
    set((state) => {
      const newTraps = new Set(state.myTraps);
      newTraps.add(tileIndex);
      return { myTraps: newTraps };
    }),
}));

export function getAdjacentTiles(tileIndex: number, boardSize: number = BOARD_SIZE): number[] {
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
