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
      locked: true
    };

    return lockedSignal;
  }

  const fullSignal: FullSignal = {
    id: signal.id,
    symbol: signal.symbol,
    locked: false,
    direction: signal.direction,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    confidence: signal.confidence,
    createdAt: signal.createdAt
  };

  return fullSignal;
}

export function applySignalAccess(
  signals: TradingSignal[],
  authContext: AuthContext
): Signal[] {
  return signals.map((signal) => toSignalView(signal, authContext));
}
