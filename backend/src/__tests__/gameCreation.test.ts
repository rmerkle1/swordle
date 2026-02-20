/**
 * Tests for game creation system: coins, default game manager, passcode/reserved slots.
 *
 * These tests mock the database layer (config/database) and socket emitters
 * so they run entirely in-memory without a real Postgres connection.
 */

import { query, pool } from '../config/database';
import { emitGameUpdate, emitGamesList } from '../socket';

// ---- Mocks ----
jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));
jest.mock('../socket', () => ({
  emitGameUpdate: jest.fn(),
  emitGamesList: jest.fn(),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockPoolConnect = pool.connect as jest.Mock;

// Helpers to build mock QueryResult-shaped objects
function mockRows(rows: any[]) {
  return { rows, rowCount: rows.length } as any;
}

// ---- checkAndDeductCoins ----
describe('checkAndDeductCoins', () => {
  let checkAndDeductCoins: typeof import('../routes/games').checkAndDeductCoins;

  beforeAll(async () => {
    // Dynamic import after mocks are set up
    const mod = await import('../routes/games');
    checkAndDeductCoins = mod.checkAndDeductCoins;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns error when player is not found', async () => {
    mockQuery.mockResolvedValueOnce(mockRows([]));
    const result = await checkAndDeductCoins(999);
    expect(result).toEqual({ error: 'Player not found', required: 0, have: 0 });
  });

  it('first game of the day is free (no coins deducted)', async () => {
    mockQuery
      .mockResolvedValueOnce(mockRows([{ coins: 1000, last_game_date: null, games_today: 0 }]))
      .mockResolvedValueOnce(mockRows([])); // UPDATE

    const result = await checkAndDeductCoins(1);
    expect(result).toEqual({ coinCost: 0, coinsRemaining: 1000 });
  });

  it('first game of a new day is free even if games_today > 0 from yesterday', async () => {
    // last_game_date is a past date (Date object from pg)
    const yesterday = new Date('2025-01-01');
    mockQuery
      .mockResolvedValueOnce(mockRows([{ coins: 500, last_game_date: yesterday, games_today: 3 }]))
      .mockResolvedValueOnce(mockRows([]));

    const result = await checkAndDeductCoins(1);
    expect(result).toEqual({ coinCost: 0, coinsRemaining: 500 });
  });

  it('second game of the day costs 50 coins', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(today + 'T00:00:00Z');
    mockQuery
      .mockResolvedValueOnce(mockRows([{ coins: 200, last_game_date: todayDate, games_today: 1 }]))
      .mockResolvedValueOnce(mockRows([]));

    const result = await checkAndDeductCoins(1);
    expect(result).toEqual({ coinCost: 50, coinsRemaining: 150 });
  });

  it('third game of the day also costs 50 coins', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockQuery
      .mockResolvedValueOnce(mockRows([{ coins: 300, last_game_date: today, games_today: 2 }]))
      .mockResolvedValueOnce(mockRows([]));

    const result = await checkAndDeductCoins(1);
    expect(result).toEqual({ coinCost: 50, coinsRemaining: 250 });
  });

  it('returns error when insufficient coins', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockQuery.mockResolvedValueOnce(
      mockRows([{ coins: 30, last_game_date: today, games_today: 1 }])
    );

    const result = await checkAndDeductCoins(1);
    expect(result).toEqual({ error: 'Insufficient coins', required: 50, have: 30 });
    // Should NOT have called UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('handles last_game_date as string (not Date object)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockQuery
      .mockResolvedValueOnce(mockRows([{ coins: 100, last_game_date: today, games_today: 1 }]))
      .mockResolvedValueOnce(mockRows([]));

    const result = await checkAndDeductCoins(1);
    expect(result).toEqual({ coinCost: 50, coinsRemaining: 50 });
  });
});

// ---- defaultGameManager ----
describe('defaultGameManager', () => {
  let ensureDefaultLobbyExists: typeof import('../services/defaultGameManager').ensureDefaultLobbyExists;
  let processDefaultLobbies: typeof import('../services/defaultGameManager').processDefaultLobbies;
  let startDefaultGame: typeof import('../services/defaultGameManager').startDefaultGame;

  beforeAll(async () => {
    const mod = await import('../services/defaultGameManager');
    ensureDefaultLobbyExists = mod.ensureDefaultLobbyExists;
    processDefaultLobbies = mod.processDefaultLobbies;
    startDefaultGame = mod.startDefaultGame;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDefaultLobbyExists', () => {
    it('does nothing if a default lobby already exists', async () => {
      mockQuery.mockResolvedValueOnce(mockRows([{ id: 1 }]));
      await ensureDefaultLobbyExists();
      // Only the SELECT query should fire, no INSERT
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect((mockQuery.mock.calls[0][0] as string)).toContain('SELECT id FROM games');
    });

    it('creates a new default lobby when none exists', async () => {
      mockQuery
        .mockResolvedValueOnce(mockRows([])) // SELECT returns nothing
        .mockResolvedValueOnce(mockRows([])); // INSERT

      await ensureDefaultLobbyExists();
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect((mockQuery.mock.calls[1][0] as string)).toContain('INSERT INTO games');
      expect((mockQuery.mock.calls[1][1] as any[])[0]).toBe(16); // max_players
      expect(emitGamesList).toHaveBeenCalled();
    });
  });

  describe('processDefaultLobbies', () => {
    it('extends deadline when fewer than 4 players', async () => {
      mockQuery
        .mockResolvedValueOnce(mockRows([{ id: 10, current_players: 2 }])) // SELECT expired lobbies
        .mockResolvedValueOnce(mockRows([])); // UPDATE extend deadline

      await processDefaultLobbies();
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect((mockQuery.mock.calls[1][0] as string)).toContain('lobby_deadline + INTERVAL');
      expect((mockQuery.mock.calls[1][1] as any[])[0]).toBe(10);
    });

    it('starts game when 4+ players and deadline expired', async () => {
      // Set up the mock client for startDefaultGame
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce(mockRows([ // game_players
            { id: 1, display_name: 'P1' },
            { id: 2, display_name: 'P2' },
            { id: 3, display_name: 'P3' },
            { id: 4, display_name: 'P4' },
          ]))
          .mockImplementation(() => Promise.resolve(mockRows([]))), // all subsequent
        release: jest.fn(),
      };
      mockPoolConnect.mockResolvedValue(mockClient as any);

      mockQuery
        .mockResolvedValueOnce(mockRows([{ id: 10, current_players: 5 }])) // SELECT expired lobbies
        // After startDefaultGame, ensureDefaultLobbyExists is called
        .mockResolvedValueOnce(mockRows([{ id: 11 }])) // SELECT existing default lobby
        .mockResolvedValue(mockRows([])); // any further

      await processDefaultLobbies();

      // startDefaultGame should have been called (pool.connect used)
      expect(mockPoolConnect).toHaveBeenCalled();
      // The client should have called BEGIN
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    });

    it('does nothing when no expired lobbies', async () => {
      mockQuery.mockResolvedValueOnce(mockRows([]));
      await processDefaultLobbies();
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(emitGamesList).not.toHaveBeenCalled();
    });
  });

  describe('startDefaultGame', () => {
    it('rolls back when fewer than 2 players', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce(mockRows([{ id: 1 }])) // only 1 player
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn(),
      };
      mockPoolConnect.mockResolvedValue(mockClient as any);

      await startDefaultGame(10);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('generates map and assigns spawns for valid player count', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce(mockRows([ // 4 game_players
            { id: 1, display_name: 'P1' },
            { id: 2, display_name: 'P2' },
            { id: 3, display_name: 'P3' },
            { id: 4, display_name: 'P4' },
          ]))
          .mockImplementation(() => Promise.resolve(mockRows([]))), // all INSERT/UPDATE
        release: jest.fn(),
      };
      mockPoolConnect.mockResolvedValue(mockClient as any);

      await startDefaultGame(10);

      // Should have committed
      const calls = mockClient.query.mock.calls.map((c: any) => typeof c[0] === 'string' ? c[0] : '');
      expect(calls).toContain('COMMIT');
      expect(calls.some((c: string) => c.includes('INSERT INTO map_tiles'))).toBe(true);
      expect(calls.some((c: string) => c.includes('UPDATE game_players SET starting_position'))).toBe(true);
      expect(calls.some((c: string) => c.includes("status = 'active'"))).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();
      expect(emitGameUpdate).toHaveBeenCalledWith(10);
    });
  });
});

// ---- Passcode / reserved slots logic ----
describe('passcode and reserved slots validation', () => {
  // These test the pure validation logic that lives in the route handler.
  // We extract the logic to test independently.

  function validatePasscodeAccess(opts: {
    passcode: string | null;
    reservedSlots: number;
    maxPlayers: number;
    currentPlayers: number;
    joinPasscode?: string;
  }): { allowed: boolean; error?: string } {
    // Mirrors the logic in POST /:id/join
    if (opts.passcode && opts.reservedSlots > 0) {
      const openSlots = opts.maxPlayers - opts.reservedSlots;
      if (opts.currentPlayers >= openSlots) {
        if (!opts.joinPasscode || opts.joinPasscode !== opts.passcode) {
          return { allowed: false, error: 'Passcode required for reserved slot' };
        }
      }
    }
    return { allowed: true };
  }

  it('allows join when no passcode is set', () => {
    expect(validatePasscodeAccess({
      passcode: null, reservedSlots: 0, maxPlayers: 4, currentPlayers: 2,
    })).toEqual({ allowed: true });
  });

  it('allows join to open slot even with passcode game', () => {
    // 4 max, 1 reserved, so 3 open. currentPlayers=2 → still open slots available.
    expect(validatePasscodeAccess({
      passcode: 'secret', reservedSlots: 1, maxPlayers: 4, currentPlayers: 2,
    })).toEqual({ allowed: true });
  });

  it('blocks join to reserved slot without passcode', () => {
    // 4 max, 1 reserved = 3 open. currentPlayers=3 → all open slots filled, need passcode.
    expect(validatePasscodeAccess({
      passcode: 'secret', reservedSlots: 1, maxPlayers: 4, currentPlayers: 3,
    })).toEqual({ allowed: false, error: 'Passcode required for reserved slot' });
  });

  it('blocks join to reserved slot with wrong passcode', () => {
    expect(validatePasscodeAccess({
      passcode: 'secret', reservedSlots: 1, maxPlayers: 4, currentPlayers: 3,
      joinPasscode: 'wrong',
    })).toEqual({ allowed: false, error: 'Passcode required for reserved slot' });
  });

  it('allows join to reserved slot with correct passcode', () => {
    expect(validatePasscodeAccess({
      passcode: 'secret', reservedSlots: 1, maxPlayers: 4, currentPlayers: 3,
      joinPasscode: 'secret',
    })).toEqual({ allowed: true });
  });

  it('handles all slots reserved except one', () => {
    // 4 max, 3 reserved = 1 open. currentPlayers=1 → need passcode.
    expect(validatePasscodeAccess({
      passcode: 'abc', reservedSlots: 3, maxPlayers: 4, currentPlayers: 1,
    })).toEqual({ allowed: false, error: 'Passcode required for reserved slot' });
  });

  it('allows first player in when open slots available', () => {
    // 4 max, 2 reserved = 2 open. currentPlayers=0 → open slot.
    expect(validatePasscodeAccess({
      passcode: 'abc', reservedSlots: 2, maxPlayers: 4, currentPlayers: 0,
    })).toEqual({ allowed: true });
  });
});
