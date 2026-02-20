import { TileType, ActionType, BuildOption } from '../types';

export const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  surfaceLight: '#0f3460',
  text: '#ffffff',
  textSecondary: '#a0a0b0',
  accent: '#e94560',
  gold: '#f0c040',
  success: '#2ecc71',
  error: '#dc3545',
};

export const TILE_COLORS: Record<TileType, string> = {
  void: 'transparent',
  empty: '#2d2d4e',
  forest: '#2d6a4f',
  mountain: '#6c757d',
  wall: '#4a3728',
  trap: '#dc3545',
  water: '#1a5276',
  storm: '#5b2c6f',
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

export const PLAYER_COLORS = [
  '#e94560', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
  '#607d8b', '#ffeb3b', '#795548', '#673ab7',
];

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
  wall: { wood: 2, metal: 1 },
  trap: { wood: 1, metal: 2 },
  upgrade: { wood: 3, metal: 1 },
};

export const BOARD_SIZE = 12;
export const BOARD_PADDING = 8;

export const UPGRADE_COSTS = [
  { wood: 3, metal: 1 },
  { wood: 5, metal: 3 },
  { wood: 8, metal: 5 },
];
