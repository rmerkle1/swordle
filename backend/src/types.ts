export type TileType = 'void' | 'empty' | 'forest' | 'mountain' | 'wall' | 'trap' | 'water' | 'storm';

export type ActionType = 'attack' | 'defend' | 'collect' | 'build' | 'scout';

export type BuildOption = 'wall' | 'trap' | 'upgrade';

export type GameStatus = 'lobby' | 'active' | 'completed';

export interface MapTile {
  index: number;
  type: TileType;
  x: number;
  y: number;
}

export interface GamePlayer {
  id: string;
  playerId: string;
  name: string;
  position: number;
  color: string;
  wood: number;
  metal: number;
  weaponTier: number;
  isAlive: boolean;
  isStunned: boolean;
  daysInStorm: number;
  stormRevealed: boolean;
}

export interface Move {
  playerId: string;
  fromTile: number;
  toTile: number;
  action: ActionType;
  buildOption?: BuildOption | null;
}

export interface GameEvent {
  id: string;
  day: number;
  message: string;
  playerId?: string;
  playerName?: string;
  playerColor?: string;
}

export interface Game {
  id: string;
  status: GameStatus;
  currentDay: number;
  maxPlayers: number;
  boardSize: number;
  tiles: MapTile[];
  players: GamePlayer[];
  events: GameEvent[];
  winner?: string;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  eliminations: number;
}
