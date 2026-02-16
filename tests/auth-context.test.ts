import assert from "node:assert/strict";
import test from "node:test";
import { ANONYMOUS_AUTH_CONTEXT } from "../src/contracts/auth-context.js";

test("anonymous auth context is unauthenticated", () => {
  assert.equal(ANONYMOUS_AUTH_CONTEXT.memberId, null);
  assert.equal(ANONYMOUS_AUTH_CONTEXT.email, null);
  assert.equal(ANONYMOUS_AUTH_CONTEXT.tier, "anonymous");
  assert.equal(ANONYMOUS_AUTH_CONTEXT.isAuthenticated, false);
});
