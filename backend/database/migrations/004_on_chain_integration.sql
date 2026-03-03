-- Migration 004: On-chain integration
-- Adds columns for on-chain move hash tracking (Phase 3)

-- Latest on-chain transaction signature
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_chain_tx VARCHAR(100);

-- Full history of chain transactions per day
ALTER TABLE games ADD COLUMN IF NOT EXISTS chain_tx_history JSONB DEFAULT '[]';
