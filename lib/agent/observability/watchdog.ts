/**
 * Phase B B8 advisory watchdog (scope C6, matrix WD-01 … WD-07).
 *
 * Pure and read-only by construction: it receives rows, returns alerts and
 * mutates nothing. There is no requeue, cancel, kill, retry or flag flip in
 * this module, and no hidden threshold: every check is skipped and reported
 * as `unconfigured` until an explicit value is supplied.
 */

import {
  WATCHDOG_ALERT_KINDS,
  type WatchdogAlert,
  type WatchdogAlertKind,
  type WatchdogInput,
  type WatchdogReport,
  type WatchdogThresholds,
} from "./types.ts";

export const WATCHDOG_THRESHOLD_ENV = {
  staleLeaseSeconds: "AGENT_WATCHDOG_STALE_LEASE_SECONDS",
  stuckVerifyingSeconds: "AGENT_WATCHDOG_STUCK_VERIFYING_SECONDS",
  consecutiveFailures: "AGENT_WATCHDOG_CONSECUTIVE_FAILURES",
  budgetCeilingUsd: "AGENT_WATCHDOG_BUDGET_CEILING_USD",
} as const;

function parseThreshold(value: string | undefined): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Read explicit owner-editable thresholds. Missing, empty or invalid values
 * stay `null`; the evaluator never invents a default.
 */
export function readWatchdogThresholds(
  environment: Readonly<Record<string, string | undefined>>,
): WatchdogThresholds {
  return Object.freeze({
    staleLeaseSeconds: parseThreshold(
      environment[WATCHDOG_THRESHOLD_ENV.staleLeaseSeconds],
    ),
    stuckVerifyingSeconds: parseThreshold(
      environment[WATCHDOG_THRESHOLD_ENV.stuckVerifyingSeconds],
    ),
    consecutiveFailures: parseThreshold(
      environment[WATCHDOG_THRESHOLD_ENV.consecutiveFailures],
    ),
    budgetCeilingUsd: parseThreshold(
      environment[WATCHDOG_THRESHOLD_ENV.budgetCeilingUsd],
    ),
  });
}

function elapsedMs(now: Date, since: string | null): number | null {
  if (since === null) return null;
  const timestamp = Date.parse(since);
  if (!Number.isFinite(timestamp)) return null;
  return now.getTime() - timestamp;
}

function sortAlerts(alerts: readonly WatchdogAlert[]): readonly WatchdogAlert[] {
  return Object.freeze(
    [...alerts].sort((left, right) => {
      const byKind = left.kind.localeCompare(right.kind);
      if (byKind !== 0) return byKind;
      return (left.taskId ?? "").localeCompare(right.taskId ?? "");
    }),
  );
}

export function evaluateWatchdog(input: WatchdogInput): WatchdogReport {
  const { thresholds, now } = input;
  const alerts: WatchdogAlert[] = [];
  const unconfigured: WatchdogAlertKind[] = [];

  for (const kind of WATCHDOG_ALERT_KINDS) {
    const configured =
      kind === "budget_breach"
        ? thresholds.budgetCeilingUsd !== null
        : kind === "stale_lease"
          ? thresholds.staleLeaseSeconds !== null
          : kind === "stuck_verifying"
            ? thresholds.stuckVerifyingSeconds !== null
            : thresholds.consecutiveFailures !== null;
    if (!configured) unconfigured.push(kind);
  }

  if (thresholds.staleLeaseSeconds !== null) {
    const limitMs = thresholds.staleLeaseSeconds * 1_000;
    for (const task of input.tasks) {
      const age = elapsedMs(now, task.leaseExpiresAt);
      if (age !== null && age > limitMs) {
        alerts.push({
          kind: "stale_lease",
          taskId: task.taskId,
          threshold: thresholds.staleLeaseSeconds,
        });
      }
    }
  }

  if (thresholds.stuckVerifyingSeconds !== null) {
    const limitMs = thresholds.stuckVerifyingSeconds * 1_000;
    for (const task of input.tasks) {
      if (task.state !== "VERIFYING") continue;
      const age = elapsedMs(now, task.verifyingSince);
      if (age !== null && age > limitMs) {
        alerts.push({
          kind: "stuck_verifying",
          taskId: task.taskId,
          threshold: thresholds.stuckVerifyingSeconds,
        });
      }
    }
  }

  if (thresholds.consecutiveFailures !== null) {
    for (const task of input.tasks) {
      if (task.consecutiveFailures >= thresholds.consecutiveFailures) {
        alerts.push({
          kind: "repeated_failures",
          taskId: task.taskId,
          threshold: thresholds.consecutiveFailures,
        });
      }
    }
  }

  if (
    thresholds.budgetCeilingUsd !== null &&
    input.budgetSpentUsd > thresholds.budgetCeilingUsd
  ) {
    alerts.push({
      kind: "budget_breach",
      taskId: null,
      threshold: thresholds.budgetCeilingUsd,
    });
  }

  const sorted = sortAlerts(alerts);
  const status =
    sorted.length > 0
      ? ("alert" as const)
      : unconfigured.length > 0
        ? ("unconfigured" as const)
        : ("ok" as const);

  return Object.freeze({
    status,
    alerts: sorted,
    unconfigured: Object.freeze([...unconfigured]),
    thresholds,
  });
}
