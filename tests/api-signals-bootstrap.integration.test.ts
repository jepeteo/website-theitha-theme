import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import nock from "nock";
import type { TradingSignal } from "../src/contracts/signals.js";

type MockRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  query?: Record<string, string | string[] | undefined>;
};

type MockResponseCapture = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
};

type RouteResponse = {
  status: (statusCode: number) => RouteResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

function buildResponseCapture(): {
  res: RouteResponse;
  capture: MockResponseCapture;
} {
  const capture: MockResponseCapture = {
    statusCode: 200,
    headers: {},
    body: null
  };

  const res: RouteResponse = {
    status(statusCode: number) {
      capture.statusCode = statusCode;
      return res;
    },
    setHeader(name: string, value: string) {
      capture.headers[name] = value;
    },
    json(body: unknown) {
      capture.body = body;
    }
  };

  return { res, capture };
}

function setupEnv(): void {
  process.env.PUBLIC_SITE_ORIGIN = "https://www.theitha.com";
  process.env.GHOST_ORIGIN = "https://investment-trading-hub-academy.ghost.io";
  process.env.GHOST_ADMIN_API_URL =
    "https://investment-trading-hub-academy.ghost.io/ghost/api/admin/";
  process.env.GHOST_ADMIN_API_KEY =
    "adminid:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd";
  process.env.DATABASE_URL = "postgres://localhost/test";
  process.env.TWELVE_DATA_API_KEY = "test_key";
  process.env.ADMIN_PASSWORD = "test_password";
  process.env.JWKS_CACHE_TTL = "3600";
  process.env.MEMBER_CACHE_TTL = "60";
  process.env.SUMMARY_CACHE_TTL = "30";
}

const mockedSignals: TradingSignal[] = [
  {
    id: "sig_xau",
    symbol: "XAUUSD",
    status: "active",
    direction: "buy",
    entry: 2600,
    stopLoss: 2580,
    tp1: 2650,
    tp2: null,
    description: null,
    chartTimeframe: "intraday",
    riskReward: 2.5,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    tp1HitAt: null,
    tp2HitAt: null
  }
];

const mockedSummary = {
  activeSignals: 3,
  wonSignals: 10,
  lostSignals: 2,
  updatedAt: new Date().toISOString()
};

let createSignalsBootstrapHandler: typeof import("../api/signals/bootstrap.js")["createSignalsBootstrapHandler"];

before(async () => {
  setupEnv();
  nock.disableNetConnect();
  const routeModule = await import("../api/signals/bootstrap.js");
  createSignalsBootstrapHandler = routeModule.createSignalsBootstrapHandler;
});

after(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

test("bootstrap returns summary and list shapes for anonymous", async () => {
  const handler = createSignalsBootstrapHandler({
    fetchSummary: async () => mockedSummary,
    fetchSignals: async () => mockedSignals
  });

  const req: MockRequest = {
    method: "GET",
    headers: {},
    socket: { remoteAddress: "10.0.0.20" }
  };

  const { res, capture } = buildResponseCapture();
  await handler(req, res);

  assert.equal(capture.statusCode, 200);
  const body = capture.body as {
    summary: typeof mockedSummary;
    list: { tier: string; data: unknown[] };
  };
  assert.equal(body.summary.activeSignals, 3);
  assert.equal(body.list.tier, "anonymous");
  assert.equal(body.list.data.length, 1);
  assert.equal((body.list.data[0] as { locked?: boolean }).locked, true);
});
