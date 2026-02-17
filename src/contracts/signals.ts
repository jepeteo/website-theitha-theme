import type { MemberTier } from "./auth-context.js";

export type SignalSymbol = string;
export type SignalStatus = "active" | "won" | "lost";

export type TradingSignal = {
  id: string;
  symbol: SignalSymbol;
  status: SignalStatus;
  direction: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  createdAt: string;
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
