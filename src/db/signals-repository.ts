import type { Pool } from "pg";
import type {
  CreateSignalInput,
  UpdateSignalInput,
  SignalStatus,
  SignalSymbol,
  SignalsSummaryResponse,
  TradingSignal
} from "../contracts/signals.js";

type SignalRow = {
  id: string;
  symbol: SignalSymbol;
  status: SignalStatus;
  direction: "buy" | "sell";
  entry: string;
  stop_loss: string;
  tp1: string;
  tp2: string | null;
  description: string | null;
  chart_timeframe: string | null;
  risk_reward: string | null;
  created_at: Date;
  expires_at: Date;
  tp1_hit_at: Date | null;
  tp2_hit_at: Date | null;
};

type SummaryRow = {
  active_signals: string;
  won_signals: string;
  lost_signals: string;
  updated_at: Date;
};

function mapSignalRow(row: SignalRow): TradingSignal {
  return {
    id: row.id,
    symbol: row.symbol,
    status: row.status,
    direction: row.direction,
    entry: Number(row.entry),
    stopLoss: Number(row.stop_loss),
    tp1: Number(row.tp1),
    tp2: row.tp2 !== null ? Number(row.tp2) : null,
    description: row.description,
    chartTimeframe: row.chart_timeframe as TradingSignal["chartTimeframe"],
    riskReward: row.risk_reward !== null ? Number(row.risk_reward) : null,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    tp1HitAt: row.tp1_hit_at?.toISOString() ?? null,
    tp2HitAt: row.tp2_hit_at?.toISOString() ?? null
  };
}

export async function fetchSignalSummary(pool: Pool): Promise<SignalsSummaryResponse> {
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')::text AS active_signals,
      COUNT(*) FILTER (WHERE status = 'won')::text AS won_signals,
      COUNT(*) FILTER (WHERE status = 'lost')::text AS lost_signals,
      NOW() AS updated_at
    FROM signals;
  `;

  const result = await pool.query<SummaryRow>(query);
  const row = result.rows[0];

  if (!row) {
    return {
      activeSignals: 0,
      wonSignals: 0,
      lostSignals: 0,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    activeSignals: Number(row.active_signals),
    wonSignals: Number(row.won_signals),
    lostSignals: Number(row.lost_signals),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function fetchRecentSignals(
  pool: Pool,
  limit: number
): Promise<TradingSignal[]> {
  const query = `
    SELECT
      id,
      symbol,
      status,
      direction,
      entry,
      stop_loss,
      tp1,
      tp2,
      description,
      chart_timeframe,
      risk_reward,
      created_at,
      COALESCE(expires_at, created_at + INTERVAL '24 hours') AS expires_at,
      tp1_hit_at,
      tp2_hit_at
    FROM signals
    ORDER BY created_at DESC
    LIMIT $1;
  `;

  const result = await pool.query<SignalRow>(query, [limit]);
  return result.rows.map(mapSignalRow);
}

export async function fetchAllSignalsAdmin(pool: Pool): Promise<TradingSignal[]> {
  const query = `
    SELECT
      id, symbol, status, direction, entry, stop_loss, tp1, tp2,
      description, chart_timeframe, risk_reward, created_at,
      COALESCE(expires_at, created_at + INTERVAL '24 hours') AS expires_at,
      tp1_hit_at, tp2_hit_at
    FROM signals
    ORDER BY created_at DESC;
  `;
  const result = await pool.query<SignalRow>(query);
  return result.rows.map(mapSignalRow);
}

export async function createSignal(
  pool: Pool,
  input: CreateSignalInput
): Promise<TradingSignal> {
  // Calculate risk/reward from entry, stopLoss, tp1
  let riskReward: number | null = null;
  const risk = Math.abs(input.entry - input.stopLoss);
  const reward = Math.abs(input.tp1 - input.entry);
  if (risk > 0) {
    riskReward = Math.round((reward / risk) * 100) / 100;
  }

  const query = `
    INSERT INTO signals
      (symbol, direction, entry, stop_loss, tp1, tp2, description,
       chart_timeframe, risk_reward, status, created_at, expires_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active',
       COALESCE($10::timestamptz, NOW()),
       COALESCE($11::timestamptz, COALESCE($10::timestamptz, NOW()) + INTERVAL '24 hours'))
    RETURNING
      id, symbol, status, direction, entry, stop_loss, tp1, tp2,
      description, chart_timeframe, risk_reward, created_at,
      COALESCE(expires_at, created_at + INTERVAL '24 hours') AS expires_at,
      tp1_hit_at, tp2_hit_at;
  `;

  const values = [
    input.symbol,
    input.direction,
    input.entry,
    input.stopLoss,
    input.tp1,
    input.tp2 ?? null,
    input.description ?? null,
    input.chartTimeframe ?? null,
    riskReward,
    input.signalDate ?? null,
    input.expiresAt ?? null
  ];

  const result = await pool.query<SignalRow>(query, values);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return mapSignalRow(result.rows[0]!);
}

export async function updateSignal(
  pool: Pool,
  id: string,
  input: UpdateSignalInput
): Promise<TradingSignal | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    values.push(input.status);
  }
  if (input.tp1HitAt !== undefined) {
    setClauses.push(`tp1_hit_at = $${idx++}`);
    values.push(input.tp1HitAt);
  }
  if (input.tp2HitAt !== undefined) {
    setClauses.push(`tp2_hit_at = $${idx++}`);
    values.push(input.tp2HitAt);
  }

  if (setClauses.length === 0) return null;

  values.push(id);
  const query = `
    UPDATE signals SET ${setClauses.join(", ")}
    WHERE id = $${idx}
    RETURNING
      id, symbol, status, direction, entry, stop_loss, tp1, tp2,
      description, chart_timeframe, risk_reward, created_at,
      COALESCE(expires_at, created_at + INTERVAL '24 hours') AS expires_at,
      tp1_hit_at, tp2_hit_at;
  `;

  const result = await pool.query<SignalRow>(query, values);
  if (result.rows.length === 0) return null;
  return mapSignalRow(result.rows[0]!);
}

export async function deleteSignal(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM signals WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
