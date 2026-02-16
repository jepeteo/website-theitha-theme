import type { MemberTier } from "./auth-context.js";

export type SignalSymbol = "XAUUSD" | "BTCUSD" | "ETHUSD" | "US30" | "NAS100";

export type TradingSignal = {
  id: string;
  symbol: SignalSymbol;
  direction: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  createdAt: string;
};

export type LockedSignal = {
  symbol: SignalSymbol;
  locked: true;
};

export type FullSignal = {
  id: string;
  symbol: SignalSymbol;
  locked: false;
  direction: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  createdAt: string;
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
