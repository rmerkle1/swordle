import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerStats } from '../types';
import { api } from '../services/api';
import { authorizeWallet, deauthorizeWallet } from '../utils/wallet';

const STORAGE_KEY_ID = 'swordle_player_id';
const STORAGE_KEY_NAME = 'swordle_player_name';
const STORAGE_KEY_WALLET = 'swordle_wallet_address';
const STORAGE_KEY_AUTH_TOKEN = 'swordle_auth_token';

interface PlayerState {
  playerId: string;
  playerName: string;
  walletAddress: string;
  stats: PlayerStats;
  coins: number;
  gamesToday: number;
  initialized: boolean;
  needsRegistration: boolean;
  setPlayer: (id: string, name: string) => void;
  setStats: (stats: PlayerStats) => void;
  loadPlayer: () => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  registerPlayer: (name: string, pubkey: string) => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshCoins: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  playerId: '',
  playerName: '',
  walletAddress: '',
  stats: { gamesPlayed: 0, wins: 0, winRate: 0, eliminations: 0 },
  coins: 1000,
  gamesToday: 0,
  initialized: false,
  needsRegistration: false,

  setPlayer: (id, name) => set({ playerId: id, playerName: name }),
  setStats: (stats) => set({ stats }),

  loadPlayer: async () => {
    if (get().initialized) return;

    try {
      const savedWallet = await AsyncStorage.getItem(STORAGE_KEY_WALLET);

      if (savedWallet) {
        // Try to log in via backend pubkey lookup
        const player = await api.loginWithWallet(savedWallet);
        if (player) {
          await AsyncStorage.setItem(STORAGE_KEY_ID, player.id);
          await AsyncStorage.setItem(STORAGE_KEY_NAME, player.name);
          set({
            playerId: player.id,
            playerName: player.name,
            walletAddress: savedWallet,
            coins: player.coins ?? 1000,
            gamesToday: player.gamesToday ?? 0,
            initialized: true,
            needsRegistration: false,
          });
          api.getPlayerStats(player.id).then((stats) => set({ stats })).catch(() => {});
          return;
        }

        // Wallet saved but no backend record — need registration (wallet already connected)
        set({ walletAddress: savedWallet, initialized: true, needsRegistration: true });
        return;
      }

      // No saved wallet — show registration screen
      set({ initialized: true, needsRegistration: true });
    } catch (err) {
      console.error('Failed to load player:', err);
      set({ initialized: true, needsRegistration: true });
    }
  },

  connectWallet: async () => {
    const { address, authToken } = await authorizeWallet();
    await AsyncStorage.setItem(STORAGE_KEY_WALLET, address);
    await AsyncStorage.setItem(STORAGE_KEY_AUTH_TOKEN, authToken);
    set({ walletAddress: address });
  },

  disconnectWallet: async () => {
    try {
      const authToken = await AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
      if (authToken) {
        await deauthorizeWallet(authToken);
      }
    } catch {
      // Wallet may not be available; still clear local state
    }

    await AsyncStorage.multiRemove([
      STORAGE_KEY_ID,
      STORAGE_KEY_NAME,
      STORAGE_KEY_WALLET,
      STORAGE_KEY_AUTH_TOKEN,
    ]);

    set({
      playerId: '',
      playerName: '',
      walletAddress: '',
      stats: { gamesPlayed: 0, wins: 0, winRate: 0, eliminations: 0 },
      coins: 1000,
      gamesToday: 0,
      needsRegistration: true,
    });
  },

  registerPlayer: async (name: string, pubkey: string) => {
    const result = await api.registerPlayer(name.trim(), pubkey);

    await AsyncStorage.setItem(STORAGE_KEY_ID, result.id);
    await AsyncStorage.setItem(STORAGE_KEY_NAME, result.name);

    set({ playerId: result.id, playerName: result.name, coins: result.coins ?? 1000, gamesToday: result.gamesToday ?? 0, needsRegistration: false });
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

  refreshCoins: async () => {
    const { walletAddress } = get();
    if (!walletAddress) return;
    try {
      const player = await api.loginWithWallet(walletAddress);
      if (player) {
        set({ coins: player.coins ?? 1000, gamesToday: player.gamesToday ?? 0 });
      }
    } catch {
      // silently ignore
    }
  },
}));
