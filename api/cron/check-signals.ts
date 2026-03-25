import { getAppEnv } from "../../src/config/env.js";
import { getDbPool } from "../../src/db/client.js";
import {
  fetchActiveSignals,
  updateSignal
} from "../../src/db/signals-repository.js";
import type { TradingSignal } from "../../src/contracts/signals.js";
import {
  fetchLivePrice,
  SYMBOLS_WITHOUT_TWELVE_DATA_PRICE,
  toTwelveDataSymbol
} from "../../src/services/price-feed.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type SignalResult = {
  id: string;
  action: "won" | "lost" | "tp1_hit" | "expired" | "skipped";
  reason: string;
};

function isAuthorized(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no CRON_SECRET set, allow (dev mode) — on Vercel itself this is always secured
  if (!cronSecret) return true;

  const auth = req.headers["authorization"];
  const header = Array.isArray(auth) ? auth[0] : auth;
  return header === `Bearer ${cronSecret}`;
}

/**
 * Evaluates a single signal against the current live price.
 * Returns the action to take, or null if nothing should change.
 */
function evaluateSignal(
  signal: TradingSignal,
  price: number,
  now: Date
): SignalResult | null {
  const isBuy = signal.direction === "buy";
  const alreadyHitTp1 = signal.tp1HitAt !== null;

  // 1. If TP1 was already hit and TP2 exists — only check TP2
  if (alreadyHitTp1 && signal.tp2 !== null) {
    const tp2Hit = isBuy ? price >= signal.tp2 : price <= signal.tp2;
    if (tp2Hit) {
      return { id: signal.id, action: "won", reason: `TP2 hit at ${price}` };
    }
    return null; // waiting for TP2
  }

  // 2. Check expiry (only if TP1 not yet hit)
  if (!alreadyHitTp1 && new Date(signal.expiresAt) < now) {
    return {
      id: signal.id,
      action: "expired",
      reason: `Expired at ${signal.expiresAt} without hitting TP1`
    };
  }

  // 3. Check Stop Loss (only if TP1 not hit — once TP1 hit, SL no longer applies)
  if (!alreadyHitTp1) {
    const slHit = isBuy ? price <= signal.stopLoss : price >= signal.stopLoss;
    if (slHit) {
      return {
        id: signal.id,
        action: "lost",
        reason: `Stop loss hit at ${price} (SL: ${signal.stopLoss})`
      };
    }
  }

  // 4. Check TP1
  if (!alreadyHitTp1) {
    const tp1Hit = isBuy ? price >= signal.tp1 : price <= signal.tp1;
    if (tp1Hit) {
      if (signal.tp2 === null) {
        // No TP2 — signal is fully won
        return { id: signal.id, action: "won", reason: `TP1 hit at ${price}` };
      } else {
        // TP1 hit, waiting for TP2
        return {
          id: signal.id,
          action: "tp1_hit",
          reason: `TP1 hit at ${price}, waiting for TP2 (${signal.tp2})`
        };
      }
    }
  }

  return null; // nothing changed
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const env = getAppEnv();
  const pool = getDbPool(env);
  const now = new Date();

  let activeSignals: TradingSignal[];
  try {
    activeSignals = await fetchActiveSignals(pool);
  } catch (err) {
    console.error("[cron] Failed to fetch active signals:", err);
    res.status(500).json({ error: "DB error fetching signals" });
    return;
  }

  if (activeSignals.length === 0) {
    res.status(200).json({ processed: 0, results: [], message: "No active signals" });
    return;
  }

  // Deduplicate symbols and fetch one price per symbol
  const uniqueSymbols = [...new Set(activeSignals.map((s) => s.symbol))];
  const priceMap = new Map<string, number>();
  const priceErrors: string[] = [];

  for (const symbol of uniqueSymbols) {
    if (SYMBOLS_WITHOUT_TWELVE_DATA_PRICE.has(symbol.toUpperCase())) {
      continue;
    }

    try {
      const tdSymbol = toTwelveDataSymbol(symbol);
      const live = await fetchLivePrice(tdSymbol, env.twelveDataApiKey);
      priceMap.set(symbol, live.price);
      console.log(`[cron] ${symbol} live price: ${live.price}`);
    } catch (err) {
      priceErrors.push(`${symbol}: ${String(err)}`);
      console.error(`[cron] Price fetch failed for ${symbol}:`, err);
    }
  }

  const results: SignalResult[] = [];

  for (const signal of activeSignals) {
    const price = priceMap.get(signal.symbol);

    if (price === undefined) {
      results.push({
        id: signal.id,
        action: "skipped",
        reason: `No price available for ${signal.symbol}`
      });
      continue;
    }

    const evaluation = evaluateSignal(signal, price, now);
    if (!evaluation) continue;

    try {
      if (evaluation.action === "won") {
        const wasTP1Hit = signal.tp1HitAt !== null;
        await updateSignal(pool, signal.id, {
          status: "won",
          tp1HitAt: wasTP1Hit ? signal.tp1HitAt : now.toISOString(),
          tp2HitAt: signal.tp2 !== null ? now.toISOString() : undefined
        });
      } else if (evaluation.action === "lost" || evaluation.action === "expired") {
        await updateSignal(pool, signal.id, { status: "lost" });
      } else if (evaluation.action === "tp1_hit") {
        await updateSignal(pool, signal.id, { tp1HitAt: now.toISOString() });
      }
      results.push(evaluation);
      console.log(`[cron] Signal ${signal.id}: ${evaluation.action} — ${evaluation.reason}`);
    } catch (err) {
      console.error(`[cron] Failed to update signal ${signal.id}:`, err);
      results.push({
        id: signal.id,
        action: "skipped",
        reason: `DB update failed: ${String(err)}`
      });
    }
  }

  res.status(200).json({
    processed: activeSignals.length,
    results,
    priceErrors: priceErrors.length > 0 ? priceErrors : undefined,
    runAt: now.toISOString()
  });
}
