import { Game, Move, PlayerStats, ClassStats, FighterClass } from '../types';
import { API_BASE } from '../config';

// Module-level auth token
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // --- Auth endpoints ---

  async getChallenge(pubkey: string): Promise<{ message: string; nonce: string }> {
    return fetchJson<{ message: string; nonce: string }>(`${API_BASE}/auth/challenge`, {
      method: 'POST',
      body: JSON.stringify({ pubkey }),
    });
  },

  async verifySignature(pubkey: string, signature: string, nonce: string, playerName?: string): Promise<{
    token: string;
    player: { id: string; name: string; pubkey: string; coins: number; gamesToday: number };
  }> {
    return fetchJson(`${API_BASE}/auth/verify`, {
      method: 'POST',
      body: JSON.stringify({ pubkey, signature, nonce, playerName }),
    });
  },

  // --- Fighter NFT endpoints ---

  async getOwnedFighters(): Promise<{ fighters: FighterClass[] }> {
    return fetchJson<{ fighters: FighterClass[] }>(`${API_BASE}/fighters`);
  },

  async mintStarterFighter(playerName?: string): Promise<{ success: boolean; mintAddress: string }> {
    return fetchJson(`${API_BASE}/fighters/mint-starter`, {
      method: 'POST',
      body: JSON.stringify({ playerName }),
    });
  },

  // --- Game endpoints ---

  async getGames(): Promise<Game[]> {
    return fetchJson<Game[]>(`${API_BASE}/games`);
  },

  async getGame(gameId: string, gamePlayerId?: string): Promise<Game | undefined> {
    try {
      const url = gamePlayerId
        ? `${API_BASE}/games/${gameId}?playerId=${gamePlayerId}`
        : `${API_BASE}/games/${gameId}`;
      return await fetchJson<Game>(url);
    } catch {
      return undefined;
    }
  },

  async submitMove(gameId: string, move: Move): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`${API_BASE}/games/${gameId}/moves`, {
      method: 'POST',
      body: JSON.stringify(move),
    });
  },

  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    return fetchJson<PlayerStats>(`${API_BASE}/players/${playerId}/stats`);
  },

  async registerPlayer(name: string, pubkey: string): Promise<{ id: string; name: string; pubkey: string; coins: number; gamesToday: number }> {
    return fetchJson<{ id: string; name: string; pubkey: string; coins: number; gamesToday: number }>(`${API_BASE}/players`, {
      method: 'POST',
      body: JSON.stringify({ name, pubkey }),
    });
  },

  async loginWithWallet(pubkey: string): Promise<{ id: string; name: string; pubkey: string; coins: number; gamesToday: number } | null> {
    try {
      return await fetchJson<{ id: string; name: string; pubkey: string; coins: number; gamesToday: number }>(`${API_BASE}/players/login`, {
        method: 'POST',
        body: JSON.stringify({ pubkey }),
      });
    } catch {
      return null;
    }
  },

  async createGame(options: {
    maxPlayers: number;
    creatorId?: string;
    moveDeadlineHour?: number;
    fighterClass?: string;
    passcode?: string;
    reservedSlots?: number;
    mapTheme?: string;
  }): Promise<Game & { coinCost: number; coinsRemaining: number }> {
    return fetchJson<Game & { coinCost: number; coinsRemaining: number }>(`${API_BASE}/games`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  async joinGame(gameId: string, playerId?: string, fighterClass?: string, passcode?: string): Promise<{ success: boolean; game: Game; coinCost: number; coinsRemaining: number }> {
    return fetchJson<{ success: boolean; game: Game; coinCost: number; coinsRemaining: number }>(`${API_BASE}/games/${gameId}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerId, fighterClass, passcode }),
    });
  },

  async leaveGame(gameId: string, playerId?: string): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`${API_BASE}/games/${gameId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  async deleteMove(gameId: string, playerId: string): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`${API_BASE}/games/${gameId}/moves`, {
      method: 'DELETE',
      body: JSON.stringify({ playerId }),
    });
  },

  async getPendingMove(gameId: string, gamePlayerId: string): Promise<{ pendingMove: { toTile: number; action: string; buildOption: string | null; attackTarget: number | null; day: number } | null }> {
    return fetchJson(`${API_BASE}/games/${gameId}/moves/pending/${gamePlayerId}`);
  },

  async getClassStats(playerId: string): Promise<Record<FighterClass, ClassStats>> {
    return fetchJson<Record<FighterClass, ClassStats>>(`${API_BASE}/players/${playerId}/class-stats`);
  },

  // --- $SKR / Entry fee endpoints ---

  async getEntryFeeTx(gameId: string): Promise<{ needsSignature: boolean; transaction?: string; fee?: number }> {
    return fetchJson(`${API_BASE}/games/${gameId}/entry-fee-tx`, {
      method: 'POST',
    });
  },

  async getCreateFeeTx(): Promise<{ needsSignature: boolean; transaction?: string; fee?: number }> {
    return fetchJson(`${API_BASE}/games/create-fee-tx`, {
      method: 'POST',
    });
  },

  async confirmEntry(gameId: string, signedTransaction: string): Promise<{ success: boolean; txSignature: string }> {
    return fetchJson(`${API_BASE}/games/${gameId}/confirm-entry`, {
      method: 'POST',
      body: JSON.stringify({ signedTransaction }),
    });
  },
};
