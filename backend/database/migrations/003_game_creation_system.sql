-- Add coins to players (generous default for soft launch)
ALTER TABLE players ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE players ADD CONSTRAINT players_coins_nonneg CHECK (coins >= 0);

-- Daily game tracking
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_game_date DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS games_today SMALLINT NOT NULL DEFAULT 0;

-- Game type and default-game fields
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS lobby_deadline TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS passcode VARCHAR(50);
ALTER TABLE games ADD COLUMN IF NOT EXISTS reserved_slots SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS map_theme VARCHAR(30) NOT NULL DEFAULT 'default';

-- Index for quick default lobby lookup
CREATE INDEX IF NOT EXISTS idx_games_default_lobby
  ON games(is_default, status) WHERE is_default = TRUE AND status = 'lobby';
