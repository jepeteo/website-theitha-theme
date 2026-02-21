import assert from "node:assert/strict";
import test from "node:test";
import { applySignalAccess } from "../src/services/access-control.js";
import type { AuthContext } from "../src/contracts/auth-context.js";
import type { TradingSignal } from "../src/contracts/signals.js";

const baseSignal: TradingSignal = {
  id: "sig_1",
  symbol: "XAUUSD",
  status: "active",
  direction: "buy",
  entry: 2600,
  stopLoss: 2580,
  tp1: 2650,
  tp2: null,
  description: null,
  chartTimeframe: "1h",
  riskReward: 2.5,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  tp1HitAt: null,
  tp2HitAt: null
};

const btcSignal: TradingSignal = {
  ...baseSignal,
  id: "sig_2",
  symbol: "BTCUSD",
  status: "won"
};

test("anonymous members see all signals locked", () => {
  const auth: AuthContext = {
    memberId: null,
    email: null,
    tier: "anonymous",
    isAuthenticated: false
  };

  const view = applySignalAccess([baseSignal, btcSignal], auth);
  assert.equal(view[0]?.locked, true);
  assert.equal(view[1]?.locked, true);
  const firstLocked = view[0];
  if (firstLocked?.locked === true) {
    assert.equal("entry" in firstLocked, false);
    assert.equal("sl" in (firstLocked as Record<string, unknown>), false);
    assert.equal("tp1" in (firstLocked as Record<string, unknown>), false);
    assert.equal("tp2" in (firstLocked as Record<string, unknown>), false);
    assert.equal("direction" in firstLocked, false);
  }
});

test("free members see XAUUSD unlocked and other symbols locked", () => {
  const auth: AuthContext = {
    memberId: "member_123",
    email: "free@example.com",
    tier: "free",
    isAuthenticated: true
  };

  const view = applySignalAccess([baseSignal, btcSignal], auth);
  assert.equal(view[0]?.locked, false);
  assert.equal(view[1]?.locked, true);
  const lockedSignal = view[1];
  if (lockedSignal?.locked === true) {
    assert.equal("entry" in lockedSignal, false);
    assert.equal("sl" in (lockedSignal as Record<string, unknown>), false);
    assert.equal("tp1" in (lockedSignal as Record<string, unknown>), false);
    assert.equal("tp2" in (lockedSignal as Record<string, unknown>), false);
  }
});

test("paid members see all signals unlocked", () => {
  const auth: AuthContext = {
    memberId: "member_456",
    email: "paid@example.com",
    tier: "paid",
    isAuthenticated: true
  };

  const view = applySignalAccess([baseSignal, btcSignal], auth);
  assert.equal(view[0]?.locked, false);
  assert.equal(view[1]?.locked, false);
});
