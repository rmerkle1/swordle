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

  async getGame(gameId: string): Promise<Game | undefined> {
    try {
      return await fetchJson<Game>(`${API_BASE}/games/${gameId}`);
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

  async registerPlayer(name: string): Promise<{ id: string; name: string; pubkey: string }> {
    return fetchJson<{ id: string; name: string; pubkey: string }>(`${API_BASE}/players`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
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
};
