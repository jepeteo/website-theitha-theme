-- Migration: signals v2
-- Adds TP1/TP2, description, chart timeframe, expiration, RR, hit timestamps
-- Replaces single take_profit with tp1/tp2
-- Replaces confidence with risk_reward (auto-calculated by app)

BEGIN;

-- Rename existing take_profit to tp1
ALTER TABLE signals RENAME COLUMN take_profit TO tp1;

-- Drop confidence (replaced by risk_reward)
ALTER TABLE signals DROP COLUMN IF EXISTS confidence;

-- Add new columns
ALTER TABLE signals
  ADD COLUMN tp2            NUMERIC(12, 4)   DEFAULT NULL,
  ADD COLUMN description    TEXT             DEFAULT NULL,
  ADD COLUMN chart_timeframe VARCHAR(10)     DEFAULT NULL,       -- e.g. '1h', '4h', '1d'
  ADD COLUMN risk_reward    NUMERIC(6, 2)    DEFAULT NULL,       -- e.g. 2.50 means 1:2.5
  ADD COLUMN expires_at     TIMESTAMPTZ      DEFAULT NULL,       -- NULL = use created_at + 24h
  ADD COLUMN tp1_hit_at     TIMESTAMPTZ      DEFAULT NULL,
  ADD COLUMN tp2_hit_at     TIMESTAMPTZ      DEFAULT NULL;

-- Backfill expires_at for any existing rows
UPDATE signals
SET expires_at = created_at + INTERVAL '24 hours'
WHERE expires_at IS NULL;

COMMIT;
