/**
 * Phase B B6: Circuit breaker tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createCircuitBreakerMemory,
  DEFAULT_CEILINGS,
  type BreakerCeilings,
} from "./circuitBreaker.ts";

test("check allows usage within ceilings", () => {
  const breaker = createCircuitBreakerMemory();
  const decision = breaker.check(
    "ws-1",
    "task-1",
    0.01,
    1000,
    1000,
  );
  assert.equal(decision.allowed, true);
  assert.equal(decision.state, "closed");
  assert.equal(decision.reason, null);
});

test("check denies when per-task cost ceiling exceeded", () => {
  const breaker = createCircuitBreakerMemory();
  breaker.recordUsage("ws-1", "task-1", 0.09, 40000, 50000);
  const decision = breaker.check(
    "ws-1",
    "task-1",
    0.02,
    20000,
    10000,
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.ceiling, "per-task-cost");
});

test("check denies when per-task tokens ceiling exceeded", () => {
  const breaker = createCircuitBreakerMemory();
  breaker.recordUsage("ws-1", "task-1", 0.01, 45000, 10000);
  const decision = breaker.check(
    "ws-1",
    "task-1",
    0.01,
    10000,
    1000,
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.ceiling, "per-task-tokens");
});

test("check denies when per-task duration ceiling exceeded", () => {
  const breaker = createCircuitBreakerMemory();
  breaker.recordUsage("ws-1", "task-1", 0.01, 1000, 500000);
  const decision = breaker.check(
    "ws-1",
    "task-1",
    0.01,
    1000,
    200000,
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.ceiling, "per-task-duration");
});

test("check denies when per-workspace daily cost ceiling exceeded", () => {
  const breaker = createCircuitBreakerMemory();
  breaker.recordUsage("ws-1", null, 9.00, 400000, 100000);
  const decision = breaker.check(
    "ws-1",
    null,
    2.00,
    100000,
    10000,
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.ceiling, "per-workspace-daily-cost");
});

test("check denies when per-workspace daily tokens ceiling exceeded", () => {
  const breaker = createCircuitBreakerMemory();
  breaker.recordUsage("ws-1", null, 1.00, 400000, 100000);
  const decision = breaker.check(
    "ws-1",
    null,
    1.00,
    200000,
    10000,
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.ceiling, "per-workspace-daily-tokens");
});

test("check allows taskId null (no per-task checks)", () => {
  const breaker = createCircuitBreakerMemory();
  const decision = breaker.check(
    "ws-1",
    null,
    0.01,
    1000,
    1000,
  );
  assert.equal(decision.allowed, true);
});

test("getState returns closed by default", () => {
  const breaker = createCircuitBreakerMemory();
  assert.equal(breaker.getState("ws-1"), "closed");
});

test("reset sets state to closed", () => {
  const breaker = createCircuitBreakerMemory();
  breaker.reset("ws-1");
  assert.equal(breaker.getState("ws-1"), "closed");
});

test("custom ceilings are enforced", () => {
  const ceilings: BreakerCeilings = {
    perTaskCostUsd: 0.01,
    perTaskTokens: 100,
    perTaskDurationMs: 1000,
    perWorkspaceDailyCostUsd: 1.00,
    perWorkspaceDailyTokens: 1000,
  };
  const breaker = createCircuitBreakerMemory(ceilings);
  const decision = breaker.check(
    "ws-1",
    "task-1",
    0.02,
    50,
    500,
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.ceiling, "per-task-cost");
});
