-- Migration: price precision
-- Align tp2 column with entry/stop_loss/tp1 precision
-- Supports up to 5 decimal digits for forex pairs like EUR/USD

BEGIN;

ALTER TABLE signals ALTER COLUMN tp2 TYPE NUMERIC(18, 8);

COMMIT;
