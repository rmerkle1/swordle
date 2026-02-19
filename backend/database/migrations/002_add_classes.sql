-- Migration 002: Rename fighter classes and add attack_target to moves

-- Rename swordsman → knight
ALTER TABLE game_players DROP CONSTRAINT IF EXISTS game_players_fighter_class_check;
UPDATE game_players SET fighter_class = 'knight' WHERE fighter_class = 'swordsman';
ALTER TABLE game_players ADD CONSTRAINT game_players_fighter_class_check
  CHECK (fighter_class IN ('knight', 'archer', 'cavalry', 'mage'));
ALTER TABLE game_players ALTER COLUMN fighter_class SET DEFAULT 'knight';

-- Add attack_target to moves (nullable — only used by Archer/Mage)
ALTER TABLE moves ADD COLUMN IF NOT EXISTS attack_target SMALLINT;
