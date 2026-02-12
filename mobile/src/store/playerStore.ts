import { create } from 'zustand';
import { PlayerStats } from '../types';
import { TEST_PLAYER_ID, TEST_PLAYER_NAME, MOCK_PLAYER_STATS } from '../data/mockData';

interface PlayerState {
  playerId: string;
  playerName: string;
  stats: PlayerStats;
  setPlayer: (id: string, name: string) => void;
  setStats: (stats: PlayerStats) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playerId: TEST_PLAYER_ID,
  playerName: TEST_PLAYER_NAME,
  stats: MOCK_PLAYER_STATS,
  setPlayer: (id, name) => set({ playerId: id, playerName: name }),
  setStats: (stats) => set({ stats }),
}));
