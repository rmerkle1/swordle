-- Swordle Database Schema (MVP Version - Simplified)
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- GAMES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    game_pubkey VARCHAR(100) UNIQUE,
    creator_pubkey VARCHAR(100),
    max_players SMALLINT NOT NULL DEFAULT 4,
    current_players SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby', -- lobby, active, completed
    current_day SMALLINT NOT NULL DEFAULT 0,
    map_size SMALLINT NOT NULL DEFAULT 64, -- 8x8 grid
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    winner_pubkey VARCHAR(100),
    move_deadline_utc_hour SMALLINT NOT NULL DEFAULT 0, -- 0-23, hour in UTC when moves auto-process

    CHECK (max_players >= 2 AND max_players <= 16),
    CHECK (move_deadline_utc_hour >= 0 AND move_deadline_utc_hour <= 23),
    CHECK (status IN ('lobby', 'active', 'completed'))
);

CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created ON games(created_at DESC);

-- ==========================================
-- PLAYERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    pubkey VARCHAR(100) NOT NULL UNIQUE,
    username VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_players_pubkey ON players(pubkey);

-- ==========================================
-- GAME PLAYERS (players in specific games)
-- ==========================================
CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_pubkey VARCHAR(100) NOT NULL,
    display_name VARCHAR(50),
    color VARCHAR(10),
    fighter_class VARCHAR(20) NOT NULL DEFAULT 'knight',
    starting_position SMALLINT,
    current_position SMALLINT,
    weapon_tier SMALLINT NOT NULL DEFAULT 1,
    wood SMALLINT NOT NULL DEFAULT 0,
    metal SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, eliminated
    is_stunned BOOLEAN NOT NULL DEFAULT FALSE,
    days_in_storm SMALLINT NOT NULL DEFAULT 0,
    storm_revealed BOOLEAN NOT NULL DEFAULT FALSE,
    last_move_day SMALLINT NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    eliminated_by_player_id INTEGER REFERENCES game_players(id),

    UNIQUE(game_id, player_id),
    CHECK (fighter_class IN ('knight', 'archer', 'cavalry', 'mage')),
    CHECK (status IN ('active', 'eliminated')),
    CHECK (weapon_tier >= 0 AND weapon_tier <= 4),
    CHECK (wood >= 0 AND metal >= 0)
);

CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_players_status ON game_players(game_id, status);

-- ==========================================
-- MAP TILES
-- ==========================================
CREATE TABLE IF NOT EXISTS map_tiles (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    tile_index SMALLINT NOT NULL,
    tile_type VARCHAR(20) NOT NULL DEFAULT 'empty',
    is_traversable BOOLEAN NOT NULL DEFAULT TRUE,
    is_landmark BOOLEAN NOT NULL DEFAULT FALSE,
    placed_by_player_id INTEGER REFERENCES game_players(id),
    placed_day SMALLINT,

    UNIQUE(game_id, tile_index),
    CHECK (tile_type IN ('empty', 'forest', 'mountain', 'wall', 'trap', 'void', 'water', 'storm'))
);

CREATE INDEX idx_map_tiles_game ON map_tiles(game_id);

-- ==========================================
-- MOVES (one per player per day)
-- ==========================================
CREATE TABLE IF NOT EXISTS moves (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    game_player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
    day SMALLINT NOT NULL,
    destination SMALLINT NOT NULL,
    action VARCHAR(20) NOT NULL,
    build_option VARCHAR(20),
    attack_target SMALLINT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE(game_id, game_player_id, day),
    CHECK (action IN ('attack', 'defend', 'collect', 'build', 'scout')),
    CHECK (day > 0)
);

CREATE INDEX idx_moves_game_day ON moves(game_id, day);
CREATE INDEX idx_moves_unprocessed ON moves(game_id, day, processed) WHERE NOT processed;

-- ==========================================
-- GAME EVENTS (combat logs, eliminations)
-- ==========================================
CREATE TABLE IF NOT EXISTS game_events (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    day SMALLINT NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    message TEXT,
    player_id INTEGER REFERENCES game_players(id),
    target_player_id INTEGER REFERENCES game_players(id),
    tile_index SMALLINT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (event_type IN ('combat', 'elimination', 'resource_gain', 'weapon_upgrade', 'move', 'storm', 'build', 'scout'))
);

CREATE INDEX idx_game_events_game ON game_events(game_id, day);

-- ==========================================
-- PLAYER STATS (overall progression)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_stats (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
    total_games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    eliminations INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (total_games >= 0 AND wins >= 0 AND losses >= 0 AND eliminations >= 0)
);

CREATE INDEX idx_player_stats_wins ON player_stats(wins DESC);

-- ==========================================
-- SEED DATA (for testing)
-- ==========================================

-- Create a test player
INSERT INTO players (pubkey, username)
VALUES ('TestPlayer1111111111111111111111111111', 'Test Player 1')
ON CONFLICT (pubkey) DO NOTHING;

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to get game state
CREATE OR REPLACE FUNCTION get_game_state(p_game_id INTEGER)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'game', row_to_json(g.*),
        'players', (
            SELECT json_agg(row_to_json(gp.*))
            FROM game_players gp
            WHERE gp.game_id = p_game_id
        ),
        'tiles', (
            SELECT json_agg(row_to_json(mt.*))
            FROM map_tiles mt
            WHERE mt.game_id = p_game_id
        )
    ) INTO result
    FROM games g
    WHERE g.id = p_game_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check if all players submitted moves for a day
CREATE OR REPLACE FUNCTION all_moves_submitted(p_game_id INTEGER, p_day INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    active_players INTEGER;
    submitted_moves INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_players
    FROM game_players
    WHERE game_id = p_game_id AND status = 'active';

    SELECT COUNT(*) INTO submitted_moves
    FROM moves
    WHERE game_id = p_game_id AND day = p_day;

    RETURN submitted_moves >= active_players;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- VIEWS FOR LEADERBOARD
-- ==========================================

CREATE OR REPLACE VIEW leaderboard AS
SELECT
    p.pubkey,
    p.username,
    ps.total_games,
    ps.wins,
    ps.losses,
    ps.eliminations,
    ROUND(100.0 * ps.wins / NULLIF(ps.total_games, 0), 2) AS win_rate
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
WHERE ps.total_games > 0
ORDER BY ps.wins DESC, ps.eliminations DESC
LIMIT 100;

-- ==========================================
-- COMPLETED!
-- ==========================================

-- Verify schema
SELECT 'Schema created successfully! Tables: ' || count(*) as status
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
