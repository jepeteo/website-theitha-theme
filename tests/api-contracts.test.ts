import assert from "node:assert/strict";
import test from "node:test";
import type {
  SignalsListResponse,
  SignalsSummaryResponse
} from "../src/contracts/signals.js";

test("signals summary contract fields are numeric/date-like", () => {
  const summary: SignalsSummaryResponse = {
    activeSignals: 10,
    wonSignals: 7,
    lostSignals: 3,
    updatedAt: new Date().toISOString()
  };

  assert.equal(typeof summary.activeSignals, "number");
  assert.equal(typeof summary.wonSignals, "number");
  assert.equal(typeof summary.lostSignals, "number");
  assert.ok(summary.updatedAt.length > 0);
});

test("locked signal response shape has null confidential fields", () => {
  const list: SignalsListResponse = {
    tier: "free",
    data: [
      {
        symbol: "BTCUSD",
        locked: true
      }
    ]
  };

  assert.equal(list.data[0]?.locked, true);
  const lockedSignal = list.data[0];
  if (lockedSignal?.locked === true) {
    assert.equal("entry" in lockedSignal, false);
    assert.equal("sl" in (lockedSignal as Record<string, unknown>), false);
    assert.equal("tp1" in (lockedSignal as Record<string, unknown>), false);
    assert.equal("tp2" in (lockedSignal as Record<string, unknown>), false);
    assert.equal("direction" in lockedSignal, false);
  }
});
