import { XAUUSD_SYMBOL } from "../config/constants.js";
import type { AuthContext } from "../contracts/auth-context.js";
import type { FullSignal, LockedSignal, Signal, TradingSignal } from "../contracts/signals.js";

function canViewFullSignal(authContext: AuthContext, symbol: string): boolean {
  if (!authContext.isAuthenticated) {
    return false;
  }

  if (authContext.tier === "paid") {
    return true;
  }

  return symbol === XAUUSD_SYMBOL;
}

export function toSignalView(
  signal: TradingSignal,
  authContext: AuthContext
): Signal {
  const isVisible = canViewFullSignal(authContext, signal.symbol);

  if (!isVisible) {
    const lockedSignal: LockedSignal = {
      symbol: signal.symbol,
      status: signal.status,
      locked: true
    };

    return lockedSignal;
  }

  const fullSignal: FullSignal = {
    id: signal.id,
    symbol: signal.symbol,
    status: signal.status,
    locked: false,
    direction: signal.direction,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    tp1: signal.tp1,
    tp2: signal.tp2,
    description: signal.description,
    chartTimeframe: signal.chartTimeframe,
    riskReward: signal.riskReward,
    createdAt: signal.createdAt,
    expiresAt: signal.expiresAt,
    tp1HitAt: signal.tp1HitAt,
    tp2HitAt: signal.tp2HitAt
  };

  return fullSignal;
}

export function applySignalAccess(
  signals: TradingSignal[],
  authContext: AuthContext
): Signal[] {
  return signals.map((signal) => toSignalView(signal, authContext));
}
