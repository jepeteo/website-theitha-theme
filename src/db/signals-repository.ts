import type { Pool } from "pg";
import type {
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
  take_profit: string;
  confidence: string;
  created_at: Date;
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
    takeProfit: Number(row.take_profit),
    confidence: Number(row.confidence),
    createdAt: row.created_at.toISOString()
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
      take_profit,
      confidence,
      created_at
    FROM signals
    ORDER BY created_at DESC
    LIMIT $1;
  `;

  const result = await pool.query<SignalRow>(query, [limit]);
  return result.rows.map(mapSignalRow);
}
