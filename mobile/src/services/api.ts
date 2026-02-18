import { Game, Move, PlayerStats } from '../types';
import { API_BASE } from '../config';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
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

  async registerPlayer(name: string, pubkey: string): Promise<{ id: string; name: string; pubkey: string }> {
    return fetchJson<{ id: string; name: string; pubkey: string }>(`${API_BASE}/players`, {
      method: 'POST',
      body: JSON.stringify({ name, pubkey }),
    });
  },

  async loginWithWallet(pubkey: string): Promise<{ id: string; name: string; pubkey: string } | null> {
    try {
      return await fetchJson<{ id: string; name: string; pubkey: string }>(`${API_BASE}/players/login`, {
        method: 'POST',
        body: JSON.stringify({ pubkey }),
      });
    } catch {
      return null;
    }
  },

  async createGame(maxPlayers: number, creatorId: string): Promise<Game> {
    return fetchJson<Game>(`${API_BASE}/games`, {
      method: 'POST',
      body: JSON.stringify({ maxPlayers, creatorId }),
    });
  },

  async joinGame(gameId: string, playerId: string): Promise<{ success: boolean; game: Game }> {
    return fetchJson<{ success: boolean; game: Game }>(`${API_BASE}/games/${gameId}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  async leaveGame(gameId: string, playerId: string): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`${API_BASE}/games/${gameId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  async getPendingMove(gameId: string, gamePlayerId: string): Promise<{ pendingMove: { toTile: number; action: string; buildOption: string | null; day: number } | null }> {
    return fetchJson(`${API_BASE}/games/${gameId}/moves/pending/${gamePlayerId}`);
  },
};
