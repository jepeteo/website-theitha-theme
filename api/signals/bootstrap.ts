import { getAppEnv } from "../../src/config/env.js";
import type {
  SignalsBootstrapResponse,
  SignalsListResponse,
  SignalsSummaryResponse,
  TradingSignal
} from "../../src/contracts/signals.js";
import { getDbPool } from "../../src/db/client.js";
import {
  fetchRecentSignals,
  fetchSignalSummary
} from "../../src/db/signals-repository.js";
import { applySignalAccess } from "../../src/services/access-control.js";
import { resolveAuthContextFromRequest } from "../../src/services/auth-context-resolver.js";
import { ApiError, isApiError } from "../../src/security/errors.js";
import { checkRateLimit } from "../../src/security/rate-limit.js";

// Mirrors summary + list caching: shared summary slot, per–tier:limit list (production only).
let bootstrapSummaryCache: {
  data: SignalsSummaryResponse;
  expiresAtMs: number;
} | null = null;

const bootstrapListCache = new Map<
  string,
  { data: SignalsListResponse; expiresAtMs: number }
>();

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

type BootstrapHandlerDeps = {
  fetchSummary?: () => Promise<SignalsSummaryResponse>;
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

async function defaultFetchSummary(): Promise<SignalsSummaryResponse> {
  const env = getAppEnv();
  const pool = getDbPool(env);
  return fetchSignalSummary(pool);
}

function defaultFetchSignals(limit: number): Promise<TradingSignal[]> {
  const env = getAppEnv();
  const pool = getDbPool(env);
  return fetchRecentSignals(pool, limit);
}

export function createSignalsBootstrapHandler(deps: BootstrapHandlerDeps = {}) {
  const fetchSummary = deps.fetchSummary ?? defaultFetchSummary;
  const fetchSignals = deps.fetchSignals ?? defaultFetchSignals;
  const useResponseCache =
    deps.fetchSummary === undefined && deps.fetchSignals === undefined;

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
      const rateLimit = checkRateLimit(`bootstrap:${clientIp}`, 60, 60);
      res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
      res.setHeader("X-RateLimit-Reset", String(rateLimit.resetAtEpochMs));

      if (!rateLimit.allowed) {
        throw new ApiError(429, "RATE_LIMITED", "Too many requests");
      }

      const authContext = await resolveAuthContextFromRequest(req);
      const limit = readLimitParam(req.query);
      const listCacheKey = `${authContext.tier}:${limit}`;
      const env = getAppEnv();
      const ttlMs = env.summaryCacheTtlSeconds * 1000;
      const nowMs = Date.now();

      let summaryData: SignalsSummaryResponse;
      let listResponse: SignalsListResponse;

      if (useResponseCache) {
        const summaryFresh =
          bootstrapSummaryCache !== null && bootstrapSummaryCache.expiresAtMs > nowMs;
        const listEntry = bootstrapListCache.get(listCacheKey);
        const listFresh = listEntry !== undefined && listEntry.expiresAtMs > nowMs;

        if (summaryFresh && listFresh) {
          summaryData = bootstrapSummaryCache!.data;
          listResponse = listEntry!.data;
        } else if (!summaryFresh && !listFresh) {
          const [summary, signals] = await Promise.all([
            fetchSummary(),
            fetchSignals(limit)
          ]);
          summaryData = summary;
          listResponse = {
            tier: authContext.tier,
            data: applySignalAccess(signals, authContext)
          };
          const expiresAtMs = Date.now() + ttlMs;
          bootstrapSummaryCache = { data: summaryData, expiresAtMs };
          bootstrapListCache.set(listCacheKey, { data: listResponse, expiresAtMs });
        } else if (!summaryFresh) {
          summaryData = await fetchSummary();
          bootstrapSummaryCache = {
            data: summaryData,
            expiresAtMs: Date.now() + ttlMs
          };
          if (listFresh) {
            listResponse = listEntry!.data;
          } else {
            const signals = await fetchSignals(limit);
            listResponse = {
              tier: authContext.tier,
              data: applySignalAccess(signals, authContext)
            };
            bootstrapListCache.set(listCacheKey, {
              data: listResponse,
              expiresAtMs: Date.now() + ttlMs
            });
          }
        } else {
          summaryData = bootstrapSummaryCache!.data;
          const signals = await fetchSignals(limit);
          listResponse = {
            tier: authContext.tier,
            data: applySignalAccess(signals, authContext)
          };
          bootstrapListCache.set(listCacheKey, {
            data: listResponse,
            expiresAtMs: Date.now() + ttlMs
          });
        }
      } else {
        summaryData = await fetchSummary();
        const signals = await fetchSignals(limit);
        listResponse = {
          tier: authContext.tier,
          data: applySignalAccess(signals, authContext)
        };
      }

      const body: SignalsBootstrapResponse = {
        summary: summaryData,
        list: listResponse
      };

      res.status(200).json(body);
    } catch (error: unknown) {
      if (isApiError(error)) {
        res.status(error.statusCode).json({
          code: error.code,
          message: error.message
        });
        return;
      }

      console.error("signals/bootstrap unexpected error", error);

      res.status(500).json({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error"
      });
    }
  };
}

export default createSignalsBootstrapHandler();
