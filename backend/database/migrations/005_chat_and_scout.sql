-- Add 'chat' to game_events event_type CHECK
ALTER TABLE game_events DROP CONSTRAINT IF EXISTS game_events_event_type_check;
ALTER TABLE game_events ADD CONSTRAINT game_events_event_type_check
  CHECK (event_type IN ('combat','elimination','resource_gain','weapon_upgrade','move','storm','build','scout','chat'));

-- Scope events to specific players (NULL = visible to all)
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS visible_to_player_id INTEGER REFERENCES game_players(id);

-- Track active scout status for real-time reveals
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS last_scout_day SMALLINT NOT NULL DEFAULT 0;
