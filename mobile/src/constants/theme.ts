import { TileType, ActionType, BuildOption } from '../types';

export const COLORS = {
  background: '#101011',
  surface: '#1c1c1e',
  surfaceLight: '#2c2c2e',
  text: '#f4f0eb',
  textSecondary: '#a1a79d',
  accent: '#d74983',
  gold: '#d74983',
  success: '#88a5bb',
  error: '#dc3545',
};

export const TILE_EMOJI: Record<TileType, string> = {
  void: '',
  empty: '',
  forest: '\u{1F332}',
  mountain: '\u{26F0}\uFE0F',
  wall: '\u{1F9F1}',
  trap: '\u{1F4A5}',
  water: '\u{1F30A}',
  storm: '\u{1F329}\uFE0F',
};

export const PLAYER_COLORS = ['red', 'blue', 'yellow', 'purple', 'green'];

export const ACTION_EMOJI: Record<ActionType, string> = {
  attack: '\u{2694}\uFE0F',
  defend: '\u{1F6E1}\uFE0F',
  collect: '\u{1F4E6}',
  build: '\u{1F528}',
  scout: '\u{1F441}\uFE0F',
};

export const BUILD_EMOJI: Record<BuildOption, string> = {
  wall: '\u{1F9F1}',
  trap: '\u{1F4A5}',
  upgrade: '\u{2B06}\uFE0F',
};

export const BUILD_COSTS: Record<BuildOption, { wood: number; metal: number }> = {
  wall: { wood: 1, metal: 0 },
  trap: { wood: 0, metal: 1 },
  upgrade: { wood: 1, metal: 1 },
};

export const BOARD_SIZE = 12;
export const BOARD_PADDING = 8;

export const UPGRADE_COSTS = [
  { wood: 1, metal: 1 },
  { wood: 1, metal: 1 },
  { wood: 1, metal: 1 },
];
