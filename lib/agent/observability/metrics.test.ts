/**
 * B8 observability aggregate tests (matrix OB-05, OB-06, OB-07).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  computeObservabilitySummary,
  percentile,
} from "./metrics.ts";
import type { ObservabilitySummaryInput } from "./types.ts";

const fixture: ObservabilitySummaryInput = {
  tasks: [
    {
      state: "COMPLETE",
      failureReason: null,
      tier: "T1",
      durationMs: 100,
    },
    {
      state: "FAILED",
      failureReason: "deadline_exceeded",
      tier: "T4",
      durationMs: 300,
    },
    {
      state: "FAILED",
      failureReason: "deadline_exceeded",
      tier: "T4",
      durationMs: 200,
    },
    {
      state: "CANCELLED",
      failureReason: null,
      tier: null,
      durationMs: 50,
    },
    {
      state: "VERIFYING",
      failureReason: null,
      tier: "T0",
      durationMs: null,
    },
  ],
  audits: [
    { status: "SUCCEEDED", errorClass: null, durationMs: 10 },
    { status: "FAILED", errorClass: "TIMEOUT", durationMs: 20 },
    { status: "FAILED", errorClass: "tool args: secret text", durationMs: 30 },
  ],
  usage: [{ costEstimateUsd: 1.5 }, { costEstimateUsd: 2.5 }],
  budgetCeilingUsd: null,
  retentionConfigured: false,
};

test("OB-06 fixed fixture yields exact status, error, tier and percentile aggregates", () => {
  const summary = computeObservabilitySummary(fixture);

  assert.equal(summary.dataComplete, true);
  assert.equal(summary.tasks.total, 5);
  assert.deepEqual(summary.tasks.byStatus, {
    AWAITING_APPROVAL: 0,
    CANCELLED: 1,
    CLARIFY: 0,
    COMPLETE: 1,
    EXECUTING: 0,
    FAILED: 2,
    INTAKE: 0,
    NEEDS_USER_INPUT: 0,
    PLANNING: 0,
    VERIFYING: 1,
  });
  assert.deepEqual(summary.tasks.byErrorClass, { deadline_exceeded: 2 });
  assert.deepEqual(summary.tasks.byTier, {
    T0: 1,
    T1: 1,
    T2: 0,
    T3: 0,
    T4: 2,
    T5: 0,
    unknown: 1,
  });
  assert.deepEqual(summary.tasks.durations, {
    sampleSize: 4,
    p50Ms: 100,
    p95Ms: 300,
    maxMs: 300,
  });

  assert.equal(summary.audits.total, 3);
  assert.deepEqual(summary.audits.byStatus, { failed: 2, succeeded: 1 });
  assert.deepEqual(summary.audits.byErrorClass, { other: 1, timeout: 1 });
  assert.deepEqual(summary.audits.durations, {
    sampleSize: 3,
    p50Ms: 20,
    p95Ms: 30,
    maxMs: 30,
  });
});

test("OB-06 no budget value is invented when OD-B7 is unconfigured", () => {
  const summary = computeObservabilitySummary(fixture);

  assert.deepEqual(summary.budget, {
    status: "unconfigured",
    ceilingUsd: null,
    spentUsd: 4,
    remainingUsd: null,
    breached: false,
  });
  assert.deepEqual(summary.retention, { status: "unconfigured" });
});

test("OB-07 an empty store is all zeros with data_complete true and no error", () => {
  const summary = computeObservabilitySummary({
    tasks: [],
    audits: [],
    usage: [],
    budgetCeilingUsd: null,
    retentionConfigured: false,
  });

  assert.equal(summary.dataComplete, true);
  assert.equal(summary.tasks.total, 0);
  assert.equal(Object.values(summary.tasks.byStatus).every((value) => value === 0), true);
  assert.deepEqual(summary.tasks.byErrorClass, {});
  assert.equal(Object.values(summary.tasks.byTier).every((value) => value === 0), true);
  assert.deepEqual(summary.tasks.durations, {
    sampleSize: 0,
    p50Ms: null,
    p95Ms: null,
    maxMs: null,
  });
  assert.deepEqual(summary.audits.byStatus, {});
  assert.equal(summary.budget.spentUsd, 0);
  assert.equal(summary.budget.status, "unconfigured");
});

test("OB-05 the response schema is content-free and bounded", () => {
  const json = JSON.stringify(computeObservabilitySummary(fixture));

  assert.equal(json.includes("tool args"), false);
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("deadline_exceeded"), true);

  const parsed = JSON.parse(json) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed), [
    "dataComplete",
    "tasks",
    "audits",
    "budget",
    "retention",
  ]);
});

test("percentile is a deterministic nearest-rank calculation", () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([5], 95), 5);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.equal(percentile([1, 2, 3, 4], 95), 4);
  assert.equal(percentile([4, 3, 2, 1], 100), 4);
  assert.equal(percentile([4, 3, 2, 1], 0), 1);
  assert.equal(percentile([1, -1, Number.NaN, 2], 50), 1);
});
