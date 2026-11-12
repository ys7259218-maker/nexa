/**
 * Phase B B6: Usage ledger tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createUsageLedgerMemory,
  estimateCostUsd,
  estimateTokens,
  type UsageLedgerEntry,
} from "./usageLedger.ts";

test("record creates and returns an id", async () => {
  const ledger = createUsageLedgerMemory();
  const id = await ledger.record({
    workspaceId: "ws-1",
    taskId: "task-1",
    model: "mock",
    provider: "mock",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costEstimateUsd: 0.001,
    durationMs: 10,
  });
  assert.equal(typeof id, "string");
  assert.equal(id.length > 0, true);
});

test("list returns workspace-scoped entries", async () => {
  const ledger = createUsageLedgerMemory();
  await ledger.record({
    workspaceId: "ws-1",
    taskId: null,
    model: "mock",
    provider: "mock",
    inputTokens: 10,
    outputTokens: 10,
    totalTokens: 20,
    costEstimateUsd: 0.0001,
    durationMs: 5,
  });
  await ledger.record({
    workspaceId: "ws-2",
    taskId: null,
    model: "mock",
    provider: "mock",
    inputTokens: 10,
    outputTokens: 10,
    totalTokens: 20,
    costEstimateUsd: 0.0001,
    durationMs: 5,
  });

  const ws1 = await ledger.list("ws-1");
  const ws2 = await ledger.list("ws-2");
  assert.equal(ws1.length, 1);
  assert.equal(ws2.length, 1);
  assert.equal(ws1[0].workspaceId, "ws-1");
  assert.equal(ws2[0].workspaceId, "ws-2");
});

test("rollup aggregates workspace usage", async () => {
  const ledger = createUsageLedgerMemory();
  await ledger.record({
    workspaceId: "ws-1",
    taskId: "task-1",
    model: "mock",
    provider: "mock",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costEstimateUsd: 0.0015,
    durationMs: 20,
  });
  await ledger.record({
    workspaceId: "ws-1",
    taskId: "task-2",
    model: "mock",
    provider: "mock",
    inputTokens: 200,
    outputTokens: 100,
    totalTokens: 300,
    costEstimateUsd: 0.003,
    durationMs: 40,
  });

  const rollup = await ledger.rollup("ws-1", 0, Date.now());
  assert.equal(rollup.workspaceId, "ws-1");
  assert.equal(rollup.taskCount, 2);
  assert.equal(rollup.totalInputTokens, 300);
  assert.equal(rollup.totalOutputTokens, 150);
  assert.equal(rollup.totalTokens, 450);
  assert.equal(Math.round(rollup.totalCostEstimateUsd * 1e6) / 1e6, 0.0045);
});

test("rollup filters by time window", async () => {
  const ledger = createUsageLedgerMemory();
  const now = Date.now();
  await ledger.record({
    workspaceId: "ws-1",
    taskId: null,
    model: "mock",
    provider: "mock",
    inputTokens: 10,
    outputTokens: 10,
    totalTokens: 20,
    costEstimateUsd: 0.0001,
    durationMs: 5,
  });

  const recent = await ledger.rollup("ws-1", now - 1000, now + 1000);
  assert.equal(recent.taskCount, 1);

  const old = await ledger.rollup("ws-1", 0, now - 2000);
  assert.equal(old.taskCount, 0);
});

test("estimateCostUsd is deterministic", () => {
  const cost = estimateCostUsd("mock", 1000, 1000);
  assert.equal(cost, estimateCostUsd("mock", 1000, 1000));
  assert.equal(cost > 0, true);
});

test("estimateTokens returns positive count", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("hello"), 2); // 5/4 = 1.25, ceil = 2
  assert.equal(estimateTokens("a".repeat(100)), 25);
});
