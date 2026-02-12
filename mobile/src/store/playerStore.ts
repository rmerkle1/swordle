import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerStats } from '../types';
import { api } from '../services/api';

const STORAGE_KEY_ID = 'swordle_player_id';
const STORAGE_KEY_NAME = 'swordle_player_name';

interface PlayerState {
  playerId: string;
  playerName: string;
  stats: PlayerStats;
  initialized: boolean;
  needsRegistration: boolean;
  setPlayer: (id: string, name: string) => void;
  setStats: (stats: PlayerStats) => void;
  loadPlayer: () => Promise<void>;
  registerPlayer: (name: string) => Promise<void>;
  refreshStats: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  playerId: '',
  playerName: '',
  stats: { gamesPlayed: 0, wins: 0, winRate: 0, eliminations: 0 },
  initialized: false,
  needsRegistration: false,

  setPlayer: (id, name) => set({ playerId: id, playerName: name }),
  setStats: (stats) => set({ stats }),

  loadPlayer: async () => {
    if (get().initialized) return;

    try {
      const savedId = await AsyncStorage.getItem(STORAGE_KEY_ID);
      const savedName = await AsyncStorage.getItem(STORAGE_KEY_NAME);

      if (savedId && savedName) {
        set({ playerId: savedId, playerName: savedName, initialized: true, needsRegistration: false });
        api.getPlayerStats(savedId).then((stats) => set({ stats })).catch(() => {});
        return;
      }

      // No saved player — show registration screen
      set({ initialized: true, needsRegistration: true });
    } catch (err) {
      console.error('Failed to load player:', err);
      set({ initialized: true, needsRegistration: true });
    }
  },

  registerPlayer: async (name: string) => {
    const result = await api.registerPlayer(name.trim());

    await AsyncStorage.setItem(STORAGE_KEY_ID, result.id);
    await AsyncStorage.setItem(STORAGE_KEY_NAME, result.name);

    set({ playerId: result.id, playerName: result.name, needsRegistration: false });
  },

  refreshStats: async () => {
    const { playerId } = get();
    if (!playerId) return;
    try {
      const stats = await api.getPlayerStats(playerId);
      set({ stats });
    } catch {
      // silently ignore
    }
  },
}));
