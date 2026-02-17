import { getAppEnv } from "../../src/config/env.js";
import type { SignalsListResponse } from "../../src/contracts/signals.js";
import { getDbPool } from "../../src/db/client.js";
import { resolveAuthContextFromRequest } from "../../src/services/auth-context-resolver.js";
import { fetchRecentSignals } from "../../src/db/signals-repository.js";
import { applySignalAccess } from "../../src/services/access-control.js";
import { ApiError, isApiError } from "../../src/security/errors.js";
import { checkRateLimit } from "../../src/security/rate-limit.js";
import type { TradingSignal } from "../../src/contracts/signals.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end?: () => void;
};

type ListHandlerDeps = {
  fetchSignals?: (limit: number) => Promise<TradingSignal[]>;
};

function applyCorsHeaders(res: VercelResponse): void {
  const allowedOrigin = process.env.PUBLIC_SITE_ORIGIN ?? "https://www.theitha.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Ghost-Member-Uuid");
  res.setHeader("Vary", "Origin");
}

function readLimitParam(query: Record<string, string | string[] | undefined> | undefined): number {
  const raw = query?.limit;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 50;
  }

  return Math.min(parsed, 200);
}

function defaultFetchSignals(limit: number): Promise<TradingSignal[]> {
  const env = getAppEnv();
  const pool = getDbPool(env);
  return fetchRecentSignals(pool, limit);
}

export function createSignalsListHandler(deps: ListHandlerDeps = {}) {
  const fetchSignals = deps.fetchSignals ?? defaultFetchSignals;

  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    try {
      applyCorsHeaders(res);

      if (req.method === "OPTIONS") {
        res.status(204);
        if (typeof res.end === "function") {
          res.end();
        } else {
          res.json({});
        }
        return;
      }

      if (req.method !== "GET") {
        throw new ApiError(405, "METHOD_NOT_ALLOWED", "Only GET is supported");
      }

      const clientIp = req.socket?.remoteAddress ?? "unknown";
      const rateLimit = checkRateLimit(`list:${clientIp}`, 60, 60);
      res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
      res.setHeader("X-RateLimit-Reset", String(rateLimit.resetAtEpochMs));

      if (!rateLimit.allowed) {
        throw new ApiError(429, "RATE_LIMITED", "Too many requests");
      }

      const authContext = await resolveAuthContextFromRequest(req);
      const signals = await fetchSignals(readLimitParam(req.query));

      const response: SignalsListResponse = {
        tier: authContext.tier,
        data: applySignalAccess(signals, authContext)
      };

      res.status(200).json(response);
    } catch (error: unknown) {
      if (isApiError(error)) {
        res.status(error.statusCode).json({
          code: error.code,
          message: error.message
        });
        return;
      }

      console.error("signals/list unexpected error", error);

      res.status(500).json({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error"
      });
    }
  };
}

export default createSignalsListHandler();
