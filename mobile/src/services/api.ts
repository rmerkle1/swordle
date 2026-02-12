import { Game, Move, PlayerStats } from '../types';
import { MOCK_GAMES, MOCK_PLAYER_STATS } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  async getGames(): Promise<Game[]> {
    await delay(300);
    return MOCK_GAMES;
  },

  async getGame(gameId: string): Promise<Game | undefined> {
    await delay(200);
    return MOCK_GAMES.find((g) => g.id === gameId);
  },

  async submitMove(gameId: string, move: Move): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },

  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    await delay(200);
    return MOCK_PLAYER_STATS;
  },

  async createGame(maxPlayers: number): Promise<Game> {
    await delay(400);
    return { ...MOCK_GAMES[1], id: `game-${Date.now()}` };
  },

  async joinGame(gameId: string, playerId: string): Promise<{ success: boolean }> {
    await delay(300);
    return { success: true };
  },
};
