import assert from "node:assert/strict";
import test from "node:test";
import type { AppEnv } from "../src/config/env.js";
import { ApiError } from "../src/security/errors.js";
import {
  resolveAuthContextFromRequest,
  type RequestLike
} from "../src/services/auth-context-resolver.js";

const env: AppEnv = {
  publicSiteOrigin: "https://www.theitha.com",
  ghostOrigin: "https://investment-trading-hub-academy.ghost.io",
  ghostAdminApiUrl: "https://investment-trading-hub-academy.ghost.io/ghost/api/admin/",
  ghostAdminApiKey: "dummyid:abcdef1234567890abcdef1234567890",
  databaseUrl: "postgres://localhost/test",
  adminBypassEmails: [],
  jwksCacheTtlSeconds: 3600,
  memberCacheTtlSeconds: 60,
  summaryCacheTtlSeconds: 30
};

function requestWithHeaders(headers: RequestLike["headers"]): RequestLike {
  return { headers };
}

test("unauthenticated request resolves to anonymous", async () => {
  const req = requestWithHeaders({});

  const auth = await resolveAuthContextFromRequest(req, {
    env,
    verifyJwt: async () => {
      throw new Error("verify should not be called for unauthenticated request");
    },
    resolveTier: async () => {
      throw new Error("resolveTier should not be called for unauthenticated request");
    }
  });

  assert.equal(auth.isAuthenticated, false);
  assert.equal(auth.tier, "anonymous");
  assert.equal(auth.memberId, null);
});

test("invalid jwt bubbles up as unauthorized error", async () => {
  const req = requestWithHeaders({
    authorization: "Bearer invalid.token"
  });

  await assert.rejects(
    resolveAuthContextFromRequest(req, {
      env,
      verifyJwt: async () => {
        throw new ApiError(401, "INVALID_MEMBER_TOKEN", "Invalid member token");
      },
      resolveTier: async () => "free"
    }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "INVALID_MEMBER_TOKEN");
      return true;
    }
  );
});

test("valid free member resolves free tier", async () => {
  const req = requestWithHeaders({
    authorization: "Bearer valid.free.token"
  });

  const auth = await resolveAuthContextFromRequest(req, {
    env,
    verifyJwt: async () => ({
      sub: "member_free",
      email: "free@member.test"
    }),
    resolveTier: async () => "free"
  });

  assert.equal(auth.isAuthenticated, true);
  assert.equal(auth.tier, "free");
  assert.equal(auth.memberId, "member_free");
  assert.equal(auth.email, "free@member.test");
});

test("valid paid member resolves paid tier", async () => {
  const req = requestWithHeaders({
    cookie: "ghost-members-ssr=valid.paid.token"
  });

  const auth = await resolveAuthContextFromRequest(req, {
    env,
    verifyJwt: async () => ({
      sub: "member_paid",
      email: "paid@member.test"
    }),
    resolveTier: async () => "paid"
  });

  assert.equal(auth.isAuthenticated, true);
  assert.equal(auth.tier, "paid");
  assert.equal(auth.memberId, "member_paid");
  assert.equal(auth.email, "paid@member.test");
});
