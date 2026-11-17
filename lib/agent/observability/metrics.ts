/**
 * Phase B B8 content-free aggregates (scope C5a/C5b, matrix OB-06/OB-07).
 *
 * Pure functions over projections the caller already read. Nothing here
 * touches a store, a clock, the network or a database, and no field can carry
 * arguments, outputs, URLs, page text, customer text or secrets.
 */

import {
  OBSERVABILITY_TASK_STATES,
  OBSERVABILITY_TIERS,
  type ObservabilityAuditRow,
  type ObservabilityBudgetRollup,
  type ObservabilityDurationStats,
  type ObservabilitySummary,
  type ObservabilitySummaryInput,
  type ObservabilityTaskRow,
} from "./types.ts";

const SAFE_CODE = /^[a-z0-9_]{1,64}$/;

function safeCode(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  return SAFE_CODE.test(normalized) ? normalized : "other";
}

function sortedRecord(
  counts: Map<string, number>,
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const key of [...counts.keys()].sort()) {
    result[key] = counts.get(key) ?? 0;
  }
  return Object.freeze(result);
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Nearest-rank percentile. Deterministic for a given input: rank is
 * `ceil(p/100 * n)` with a 1-based index clamped into range.
 */
export function percentile(
  values: readonly number[],
  p: number,
): number | null {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;

  const bounded = Math.min(100, Math.max(0, p));
  const rank = Math.ceil((bounded / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? null;
}

function durationStats(
  values: readonly number[],
): ObservabilityDurationStats {
  const clean = values.filter((value) => Number.isFinite(value) && value >= 0);
  return Object.freeze({
    sampleSize: clean.length,
    p50Ms: percentile(clean, 50),
    p95Ms: percentile(clean, 95),
    maxMs: clean.length === 0 ? null : Math.max(...clean),
  });
}

function taskStatusCounts(
  tasks: readonly ObservabilityTaskRow[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const state of OBSERVABILITY_TASK_STATES) counts.set(state, 0);
  for (const task of tasks) {
    const state = (OBSERVABILITY_TASK_STATES as readonly string[]).includes(
      task.state,
    )
      ? task.state
      : "unknown_state";
    increment(counts, state);
  }
  return sortedRecord(counts);
}

function taskTierCounts(
  tasks: readonly ObservabilityTaskRow[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const tier of OBSERVABILITY_TIERS) counts.set(tier, 0);
  counts.set("unknown", 0);
  for (const task of tasks) {
    const tier =
      task.tier !== null &&
      (OBSERVABILITY_TIERS as readonly string[]).includes(task.tier)
        ? task.tier
        : "unknown";
    increment(counts, tier);
  }
  return sortedRecord(counts);
}

function bySafeCode(
  values: readonly (string | null)[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const code = safeCode(value);
    if (code !== null) increment(counts, code);
  }
  return sortedRecord(counts);
}

function budgetRollup(
  input: ObservabilitySummaryInput,
): ObservabilityBudgetRollup {
  const spentUsd = input.usage
    .map((row) => row.costEstimateUsd)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .reduce((total, value) => total + value, 0);

  const configured =
    typeof input.budgetCeilingUsd === "number" &&
    Number.isFinite(input.budgetCeilingUsd) &&
    input.budgetCeilingUsd >= 0;

  return Object.freeze({
    status: configured ? "configured" : "unconfigured",
    ceilingUsd: configured ? (input.budgetCeilingUsd as number) : null,
    spentUsd,
    remainingUsd: configured
      ? Math.max(0, (input.budgetCeilingUsd as number) - spentUsd)
      : null,
    breached: configured && spentUsd > (input.budgetCeilingUsd as number),
  });
}

export function computeObservabilitySummary(
  input: ObservabilitySummaryInput,
): ObservabilitySummary {
  const taskDurations: number[] = [];
  for (const task of input.tasks) {
    if (task.durationMs !== null) taskDurations.push(task.durationMs);
  }

  return Object.freeze({
    dataComplete: true as const,
    tasks: Object.freeze({
      total: input.tasks.length,
      byStatus: taskStatusCounts(input.tasks),
      byErrorClass: bySafeCode(input.tasks.map((task) => task.failureReason)),
      byTier: taskTierCounts(input.tasks),
      durations: durationStats(taskDurations),
    }),
    audits: Object.freeze({
      total: input.audits.length,
      byStatus: bySafeCode(
        input.audits.map((audit: ObservabilityAuditRow) => audit.status),
      ),
      byErrorClass: bySafeCode(
        input.audits.map((audit) => audit.errorClass),
      ),
      durations: durationStats(input.audits.map((audit) => audit.durationMs)),
    }),
    budget: budgetRollup(input),
    retention: Object.freeze({
      status: input.retentionConfigured ? "configured" : "unconfigured",
    }),
  });
}
