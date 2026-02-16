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

type HeaderShape =
  | Headers
  | Record<string, string>
  | Array<[string, string]>
  | undefined;

type RouteResponse = {
  status: (statusCode: number) => RouteResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

function expect(actual: unknown): { toBe: (expected: unknown) => void } {
  return {
    toBe(expected: unknown) {
      assert.equal(actual, expected);
    }
  };
}

type SignJWTCtor = typeof import("jose")["SignJWT"];

let SignJWTClass: SignJWTCtor;
let createSignalsListHandler: typeof import("../api/signals/list.js")["createSignalsListHandler"];
let keyPair: Awaited<ReturnType<typeof import("jose")["generateKeyPair"]>>;
let publicJwk: Awaited<ReturnType<typeof import("jose")["exportJWK"]>>;
const jwksKid = "member-key-1";

let jwksFetchCount = 0;
let ghostAdminFetchCount = 0;
let lastGhostAuthorizationHeader: string | null = null;

const originalFetch = globalThis.fetch;

const mockedSignals: TradingSignal[] = [
  {
    id: "sig_xau",
    symbol: "XAUUSD",
    direction: "buy",
    entry: 2600,
    stopLoss: 2580,
    takeProfit: 2650,
    confidence: 88,
    createdAt: new Date().toISOString()
  },
  {
    id: "sig_btc",
    symbol: "BTCUSD",
    direction: "sell",
    entry: 100000,
    stopLoss: 102000,
    takeProfit: 95000,
    confidence: 73,
    createdAt: new Date().toISOString()
  }
];

function setupEnv(): void {
  process.env.PUBLIC_SITE_ORIGIN = "https://www.theitha.com";
  process.env.GHOST_ORIGIN = "https://investment-trading-hub-academy.ghost.io";
  process.env.GHOST_ADMIN_API_URL =
    "https://investment-trading-hub-academy.ghost.io/ghost/api/admin/";
  process.env.GHOST_ADMIN_API_KEY =
    "adminid:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd";
  process.env.DATABASE_URL = "postgres://localhost/test";
  process.env.JWKS_CACHE_TTL = "3600";
  process.env.MEMBER_CACHE_TTL = "60";
  process.env.SUMMARY_CACHE_TTL = "30";
}

function getHeaderValue(headers: HeaderShape, key: string): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(key);
  }

  if (Array.isArray(headers)) {
    const match = headers.find(
      ([headerName]) => headerName.toLowerCase() === key.toLowerCase()
    );
    return match?.[1] ?? null;
  }

  const direct = headers[key as keyof typeof headers];
  if (typeof direct === "string") {
    return direct;
  }

  const lowered = headers[key.toLowerCase() as keyof typeof headers];
  return typeof lowered === "string" ? lowered : null;
}

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

async function createMemberJwt(memberId: string): Promise<string> {
  return new SignJWTClass({ email: `${memberId}@example.com` })
    .setProtectedHeader({ alg: "RS256", kid: jwksKid })
    .setSubject(memberId)
    .setIssuer("https://investment-trading-hub-academy.ghost.io")
    .setAudience("https://www.theitha.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keyPair.privateKey);
}

function assertNoSecretLeak(payload: unknown): void {
  const text = JSON.stringify(payload);
  const adminKey = process.env.GHOST_ADMIN_API_KEY ?? "";

  assert.equal(text.includes(adminKey), false);
  assert.equal(text.includes("ghost-admin"), false);
  assert.equal(text.includes("0123456789abcdef"), false);
}

before(async () => {
  setupEnv();

  const jose = await import("jose");
  SignJWTClass = jose.SignJWT;
  keyPair = await jose.generateKeyPair("RS256");
  publicJwk = await jose.exportJWK(keyPair.publicKey);

  nock.disableNetConnect();
  nock("https://investment-trading-hub-academy.ghost.io")
    .get("/members/.well-known/jwks.json")
    .times(20)
    .reply(() => {
      jwksFetchCount += 1;
      return [
        200,
        {
          keys: [
            {
              ...publicJwk,
              kid: jwksKid,
              alg: "RS256",
              use: "sig"
            }
          ]
        }
      ];
    });

  globalThis.fetch = (async (
    input: unknown,
    init?: { headers?: HeaderShape }
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : "";

    if (url.includes("/ghost/api/admin/members/")) {
      ghostAdminFetchCount += 1;
      lastGhostAuthorizationHeader = getHeaderValue(init?.headers, "Authorization");

      const isPaidMember = url.includes("member_paid");
      const body = isPaidMember
        ? {
            members: [
              {
                subscriptions: [{ status: "active" }],
                products: [{ name: "Premium Signals" }],
                tiers: [{ name: "Paid Tier" }]
              }
            ]
          }
        : {
            members: [
              {
                subscriptions: [{ status: "canceled" }],
                products: [{ name: "Free" }],
                tiers: [{ name: "Free Tier" }]
              }
            ]
          };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;

  const routeModule = await import("../api/signals/list.js");
  createSignalsListHandler = routeModule.createSignalsListHandler;
});

after(() => {
  globalThis.fetch = originalFetch;
  nock.cleanAll();
  nock.enableNetConnect();
});

test("No Authorization header returns only locked signals", async () => {
  const handler = createSignalsListHandler({
    fetchSignals: async () => mockedSignals
  });

  const req: MockRequest = {
    method: "GET",
    headers: {},
    socket: { remoteAddress: "10.0.0.1" }
  };

  const { res, capture } = buildResponseCapture();
  await handler(req, res);

  assert.equal(capture.statusCode, 200);
  assert.ok(capture.headers["X-RateLimit-Remaining"]);
  assert.ok(capture.headers["X-RateLimit-Reset"]);

  const body = capture.body as {
    tier: string;
    data: Array<Record<string, unknown>>;
  };
  assert.equal(body.tier, "anonymous");
  assert.equal(body.data.length, 2);
  assert.equal(body.data.every((item) => item.locked === true), true);
  for (const signal of body.data) {
    expect("entry" in signal).toBe(false);
    expect("sl" in signal).toBe(false);
    expect("tp1" in signal).toBe(false);
    expect("tp2" in signal).toBe(false);
    expect("direction" in signal).toBe(false);
  }
  assertNoSecretLeak(capture.body);
});

test("Valid JWT + free member returns only XAUUSD full", async () => {
  const token = await createMemberJwt("member_free");
  const handler = createSignalsListHandler({
    fetchSignals: async () => mockedSignals
  });

  const req: MockRequest = {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    socket: { remoteAddress: "10.0.0.2" }
  };

  const { res, capture } = buildResponseCapture();
  await handler(req, res);

  assert.equal(capture.statusCode, 200);
  const body = capture.body as {
    tier: string;
    data: Array<Record<string, unknown>>;
  };

  const xau = body.data.find((item) => item.symbol === "XAUUSD");
  const btc = body.data.find((item) => item.symbol === "BTCUSD");

  assert.equal(body.tier, "free");
  assert.equal(xau?.locked, false);
  assert.equal("entry" in (xau ?? {}), true);
  assert.equal("direction" in (xau ?? {}), true);
  assert.equal(btc?.locked, true);
  if (btc) {
    expect("entry" in btc).toBe(false);
    expect("sl" in btc).toBe(false);
    expect("tp1" in btc).toBe(false);
    expect("tp2" in btc).toBe(false);
    expect("direction" in btc).toBe(false);
  }

  assert.ok(lastGhostAuthorizationHeader?.startsWith("Ghost "));
  assert.equal(lastGhostAuthorizationHeader?.includes(process.env.GHOST_ADMIN_API_KEY ?? ""), false);
  assertNoSecretLeak(capture.body);
});

test("Valid JWT + paid member returns all signals full", async () => {
  const token = await createMemberJwt("member_paid");
  const handler = createSignalsListHandler({
    fetchSignals: async () => mockedSignals
  });

  const req: MockRequest = {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    socket: { remoteAddress: "10.0.0.3" }
  };

  const { res, capture } = buildResponseCapture();
  await handler(req, res);

  assert.equal(capture.statusCode, 200);
  const body = capture.body as {
    tier: string;
    data: Array<Record<string, unknown>>;
  };

  assert.equal(body.tier, "paid");
  assert.equal(body.data.every((item) => item.locked === false), true);
  assert.equal(body.data.every((item) => "entry" in item), true);
  assert.equal(body.data.every((item) => "direction" in item), true);
  assertNoSecretLeak(capture.body);
});

test("Invalid JWT returns 401", async () => {
  const handler = createSignalsListHandler({
    fetchSignals: async () => mockedSignals
  });

  const req: MockRequest = {
    method: "GET",
    headers: { authorization: "Bearer invalid.jwt.value" },
    socket: { remoteAddress: "10.0.0.4" }
  };

  const { res, capture } = buildResponseCapture();
  await handler(req, res);

  assert.equal(capture.statusCode, 401);
  const body = capture.body as { code: string; message: string };
  assert.equal(body.code, "INVALID_MEMBER_TOKEN");
  assert.equal(typeof body.message, "string");
  assertNoSecretLeak(capture.body);
});

test("Mocks are exercised (JWKS + Ghost Admin)", () => {
  assert.ok(jwksFetchCount >= 1);
  assert.ok(ghostAdminFetchCount >= 2);
});
