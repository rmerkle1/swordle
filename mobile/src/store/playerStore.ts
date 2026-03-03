import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerStats } from '../types';
import { api, setAuthToken } from '../services/api';
import { authorizeWallet, deauthorizeWallet, signAuthMessage } from '../utils/wallet';

const STORAGE_KEY_ID = 'swordle_player_id';
const STORAGE_KEY_NAME = 'swordle_player_name';
const STORAGE_KEY_WALLET = 'swordle_wallet_address';
const STORAGE_KEY_AUTH_TOKEN = 'swordle_auth_token';
const STORAGE_KEY_JWT = 'swordle_jwt';

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
  authenticateWallet: (name: string) => Promise<void>;
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
      const savedJwt = await AsyncStorage.getItem(STORAGE_KEY_JWT);
      console.log('[loadPlayer] savedWallet:', savedWallet ? savedWallet.slice(0, 8) + '...' : 'null');
      console.log('[loadPlayer] savedJwt:', savedJwt ? 'present' : 'null');

      // Restore JWT to api module
      if (savedJwt) {
        setAuthToken(savedJwt);
      }

      if (savedWallet) {
        if (savedJwt) {
          // Have JWT — try to verify it's still valid via login
          console.log('[loadPlayer] Verifying JWT via loginWithWallet...');
          const player = await api.loginWithWallet(savedWallet);
          if (player) {
            console.log('[loadPlayer] Login success — player:', player.name, 'id:', player.id);
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
          console.log('[loadPlayer] loginWithWallet returned null — JWT may be invalid');
        }

        // Wallet saved but no valid JWT or no backend record — need to re-auth or register
        console.log('[loadPlayer] Wallet saved but no valid session — showing registration');
        set({ walletAddress: savedWallet, initialized: true, needsRegistration: true });
        return;
      }

      // No saved wallet — show registration screen
      console.log('[loadPlayer] No saved wallet — showing registration');
      set({ initialized: true, needsRegistration: true });
    } catch (err) {
      console.error('[loadPlayer] Failed to load player:', err);
      set({ initialized: true, needsRegistration: true });
    }
  },

  connectWallet: async () => {
    // MWA authorize only — get wallet address and auth token
    console.log('[connectWallet] Starting MWA authorize...');
    const { address, authToken } = await authorizeWallet();
    console.log('[connectWallet] MWA authorized — address:', address.slice(0, 8) + '...');
    await AsyncStorage.setItem(STORAGE_KEY_WALLET, address);
    await AsyncStorage.setItem(STORAGE_KEY_AUTH_TOKEN, authToken);
    set({ walletAddress: address });
    console.log('[connectWallet] Wallet address saved, showing name step');
  },

  authenticateWallet: async (name: string) => {
    console.log('[authenticateWallet] Starting with name:', name);
    let { walletAddress } = get();
    let mwaAuthToken = await AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
    console.log('[authenticateWallet] walletAddress:', walletAddress ? walletAddress.slice(0, 8) + '...' : 'null');
    console.log('[authenticateWallet] mwaAuthToken:', mwaAuthToken ? 'present' : 'null');

    // If no wallet or MWA token, do a fresh MWA authorize
    if (!walletAddress || !mwaAuthToken) {
      console.log('[authenticateWallet] No wallet/token — doing fresh MWA authorize...');
      const authResult = await authorizeWallet();
      walletAddress = authResult.address;
      mwaAuthToken = authResult.authToken;
      await AsyncStorage.setItem(STORAGE_KEY_WALLET, walletAddress);
      await AsyncStorage.setItem(STORAGE_KEY_AUTH_TOKEN, mwaAuthToken);
      set({ walletAddress });
      console.log('[authenticateWallet] Fresh MWA authorize done — address:', walletAddress.slice(0, 8) + '...');
    }

    // Get challenge from backend
    console.log('[authenticateWallet] Getting challenge from backend...');
    const challenge = await api.getChallenge(walletAddress);
    console.log('[authenticateWallet] Challenge received — nonce:', challenge.nonce.slice(0, 8) + '...');

    // Sign challenge message via MWA
    console.log('[authenticateWallet] Signing challenge via MWA...');
    const signature = await signAuthMessage(challenge.message, mwaAuthToken);
    console.log('[authenticateWallet] Challenge signed — signature:', signature.slice(0, 16) + '...');

    // Verify signature with backend, get JWT (pass name for new players)
    console.log('[authenticateWallet] Verifying signature with backend...');
    const result = await api.verifySignature(walletAddress, signature, challenge.nonce, name);
    console.log('[authenticateWallet] Verified! Player:', result.player.name, 'id:', result.player.id);

    // Store JWT and set auth
    await AsyncStorage.setItem(STORAGE_KEY_JWT, result.token);
    setAuthToken(result.token);

    // Update state
    await AsyncStorage.setItem(STORAGE_KEY_ID, result.player.id);
    await AsyncStorage.setItem(STORAGE_KEY_NAME, result.player.name);

    set({
      walletAddress,
      playerId: result.player.id,
      playerName: result.player.name,
      coins: result.player.coins ?? 1000,
      gamesToday: result.player.gamesToday ?? 0,
      needsRegistration: false,
    });
    console.log('[authenticateWallet] Complete — player registered and authenticated');
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

    // Clear JWT
    setAuthToken(null);

    await AsyncStorage.multiRemove([
      STORAGE_KEY_ID,
      STORAGE_KEY_NAME,
      STORAGE_KEY_WALLET,
      STORAGE_KEY_AUTH_TOKEN,
      STORAGE_KEY_JWT,
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
