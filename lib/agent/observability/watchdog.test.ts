/**
 * B8 advisory watchdog tests (matrix WD-01 … WD-06).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateWatchdog,
  readWatchdogThresholds,
  WATCHDOG_THRESHOLD_ENV,
} from "./watchdog.ts";
import type {
  WatchdogInput,
  WatchdogTaskRow,
  WatchdogThresholds,
} from "./types.ts";

const NOW = new Date("2026-11-17T09:00:00.000Z");

const thresholds: WatchdogThresholds = {
  staleLeaseSeconds: 120,
  stuckVerifyingSeconds: 600,
  consecutiveFailures: 3,
  budgetCeilingUsd: null,
};

function task(overrides: Partial<WatchdogTaskRow> = {}): WatchdogTaskRow {
  return {
    taskId: "task-1",
    state: "EXECUTING",
    leaseExpiresAt: null,
    verifyingSince: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

function input(overrides: Partial<WatchdogInput> = {}): WatchdogInput {
  return {
    now: NOW,
    tasks: [task()],
    budgetSpentUsd: 0,
    thresholds,
    ...overrides,
  };
}

test("WD-01 a lease older than the configured threshold alerts with the task id", () => {
  const report = evaluateWatchdog(
    input({
      tasks: [
        task({
          taskId: "task-stale",
          leaseExpiresAt: "2026-11-17T08:57:59.000Z",
        }),
      ],
    }),
  );

  assert.deepEqual(report.alerts, [
    { kind: "stale_lease", taskId: "task-stale", threshold: 120 },
  ]);
  assert.equal(report.status, "alert");
});

test("WD-02 a lease inside the threshold produces no alert", () => {
  const report = evaluateWatchdog(
    input({
      tasks: [
        task({
          leaseExpiresAt: "2026-11-17T08:59:00.000Z",
        }),
      ],
    }),
  );

  assert.deepEqual(report.alerts, []);
  assert.equal(report.status, "unconfigured");
});

test("WD-03 a task stuck in VERIFYING beyond the window alerts", () => {
  const report = evaluateWatchdog(
    input({
      tasks: [
        task({
          taskId: "task-verifying",
          state: "VERIFYING",
          verifyingSince: "2026-11-17T08:49:59.000Z",
        }),
      ],
    }),
  );

  assert.deepEqual(report.alerts, [
    { kind: "stuck_verifying", taskId: "task-verifying", threshold: 600 },
  ]);
});

test("WD-04 budget usage above a configured ceiling alerts with that value", () => {
  const report = evaluateWatchdog(
    input({
      budgetSpentUsd: 10.5,
      thresholds: { ...thresholds, budgetCeilingUsd: 10 },
    }),
  );

  assert.deepEqual(report.alerts, [
    { kind: "budget_breach", taskId: null, threshold: 10 },
  ]);
});

test("WD-05 no configured ceiling means unconfigured, with no invented default", () => {
  const report = evaluateWatchdog(
    input({
      budgetSpentUsd: 999,
      thresholds: { ...thresholds, budgetCeilingUsd: null },
    }),
  );

  assert.deepEqual(report.alerts, []);
  assert.equal(report.status, "unconfigured");
  assert.ok(report.unconfigured.includes("budget_breach"));
  assert.equal(report.thresholds.budgetCeilingUsd, null);
});

test("WD-06 evaluation writes nothing and mutates no input", () => {
  const tasks = [
    task({
      taskId: "task-stale",
      leaseExpiresAt: "2026-11-17T08:57:59.000Z",
      state: "VERIFYING",
      verifyingSince: "2026-11-17T08:00:00.000Z",
      consecutiveFailures: 5,
    }),
  ];
  const before = JSON.stringify({ tasks, thresholds });
  const report = evaluateWatchdog(
    input({
      tasks,
      budgetSpentUsd: 50,
      thresholds: { ...thresholds, budgetCeilingUsd: 5 },
    }),
  );
  const after = JSON.stringify({ tasks, thresholds });

  assert.equal(before, after);
  assert.equal(report.alerts.length, 4);
  assert.ok(
    report.alerts.some((alert) => alert.kind === "budget_breach"),
    "the configured budget ceiling must alert",
  );
});

test("thresholds are explicit configuration and invalid values stay unconfigured", () => {
  assert.deepEqual(readWatchdogThresholds({}), {
    staleLeaseSeconds: null,
    stuckVerifyingSeconds: null,
    consecutiveFailures: null,
    budgetCeilingUsd: null,
  });

  const parsed = readWatchdogThresholds({
    [WATCHDOG_THRESHOLD_ENV.staleLeaseSeconds]: "120",
    [WATCHDOG_THRESHOLD_ENV.stuckVerifyingSeconds]: "-5",
    [WATCHDOG_THRESHOLD_ENV.consecutiveFailures]: "nope",
    [WATCHDOG_THRESHOLD_ENV.budgetCeilingUsd]: "25.5",
  });
  assert.deepEqual(parsed, {
    staleLeaseSeconds: 120,
    stuckVerifyingSeconds: null,
    consecutiveFailures: null,
    budgetCeilingUsd: 25.5,
  });
});
