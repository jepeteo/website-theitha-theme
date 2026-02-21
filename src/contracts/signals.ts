import type { MemberTier } from "./auth-context.js";

export type SignalSymbol = string;
export type SignalStatus = "active" | "won" | "lost";
export type ChartTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export type TradingSignal = {
  id: string;
  symbol: SignalSymbol;
  status: SignalStatus;
  direction: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number | null;
  description: string | null;
  chartTimeframe: ChartTimeframe | null;
  riskReward: number | null;
  createdAt: string;
  expiresAt: string;
  tp1HitAt: string | null;
  tp2HitAt: string | null;
};

export type LockedSignal = {
  symbol: SignalSymbol;
  status: SignalStatus;
  locked: true;
};

export type FullSignal = {
  id: string;
  symbol: SignalSymbol;
  status: SignalStatus;
  locked: false;
  direction: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number | null;
  description: string | null;
  chartTimeframe: ChartTimeframe | null;
  riskReward: number | null;
  createdAt: string;
  expiresAt: string;
  tp1HitAt: string | null;
  tp2HitAt: string | null;
};

export type Signal = LockedSignal | FullSignal;

export type SignalsListResponse = {
  tier: MemberTier;
  data: Signal[];
};

export type SignalsSummaryResponse = {
  activeSignals: number;
  wonSignals: number;
  lostSignals: number;
  updatedAt: string;
};

export type CreateSignalInput = {
  symbol: SignalSymbol;
  direction: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2?: number | null;
  description?: string | null;
  chartTimeframe?: ChartTimeframe | null;
  expiresAt?: string | null; // ISO string; null = default 24h
  signalDate?: string | null; // ISO string; null = now
};

export type UpdateSignalInput = {
  status?: SignalStatus;
  tp1HitAt?: string | null;
  tp2HitAt?: string | null;
};
