/**
 * Phase B B8 observability contracts (scope C5/C6).
 *
 * Every field here is content-free: counts, durations, states, tiers and
 * statuses only. No goal text, tool arguments, outputs, URLs, page content,
 * customer text or secrets can be represented by these types.
 */

export const OBSERVABILITY_TASK_STATES = [
  "INTAKE",
  "CLARIFY",
  "PLANNING",
  "AWAITING_APPROVAL",
  "EXECUTING",
  "VERIFYING",
  "NEEDS_USER_INPUT",
  "COMPLETE",
  "FAILED",
  "CANCELLED",
] as const;

export type ObservabilityTaskState =
  (typeof OBSERVABILITY_TASK_STATES)[number];

export const OBSERVABILITY_TIERS = ["T0", "T1", "T2", "T3", "T4", "T5"] as const;

export type ObservabilityTier = (typeof OBSERVABILITY_TIERS)[number];

export const OBSERVABILITY_BUDGET_STATUSES = [
  "configured",
  "unconfigured",
] as const;

export type ObservabilityBudgetStatus =
  (typeof OBSERVABILITY_BUDGET_STATUSES)[number];

export const OBSERVABILITY_RETENTION_STATUSES = [
  "configured",
  "unconfigured",
] as const;

export type ObservabilityRetentionStatus =
  (typeof OBSERVABILITY_RETENTION_STATUSES)[number];

/** Minimal task projection the aggregates need. No goal or evidence. */
export type ObservabilityTaskRow = Readonly<{
  state: string;
  failureReason: string | null;
  /** Plan step / checkpoint tier when known, otherwise null. */
  tier: string | null;
  /** Populated only for terminal rows. */
  durationMs: number | null;
}>;

/** Minimal audit projection: status, error class and bounded duration. */
export type ObservabilityAuditRow = Readonly<{
  status: "SUCCEEDED" | "FAILED";
  errorClass: string | null;
  durationMs: number;
}>;

export type ObservabilityUsageRow = Readonly<{
  costEstimateUsd: number;
}>;

export type ObservabilitySummaryInput = Readonly<{
  tasks: readonly ObservabilityTaskRow[];
  audits: readonly ObservabilityAuditRow[];
  usage: readonly ObservabilityUsageRow[];
  /** `null` means OD-B7 is pending: never substitute a default. */
  budgetCeilingUsd: number | null;
  /** `false` means OD-B5 is pending: never substitute a default. */
  retentionConfigured: boolean;
}>;

export type ObservabilityDurationStats = Readonly<{
  sampleSize: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}>;

export type ObservabilityBudgetRollup = Readonly<{
  status: ObservabilityBudgetStatus;
  ceilingUsd: number | null;
  spentUsd: number;
  remainingUsd: number | null;
  breached: boolean;
}>;

export type ObservabilityRetentionRollup = Readonly<{
  status: ObservabilityRetentionStatus;
}>;

export type ObservabilitySummary = Readonly<{
  dataComplete: true;
  tasks: Readonly<{
    total: number;
    byStatus: Readonly<Record<string, number>>;
    byErrorClass: Readonly<Record<string, number>>;
    byTier: Readonly<Record<string, number>>;
    durations: ObservabilityDurationStats;
  }>;
  audits: Readonly<{
    total: number;
    byStatus: Readonly<Record<string, number>>;
    byErrorClass: Readonly<Record<string, number>>;
    durations: ObservabilityDurationStats;
  }>;
  budget: ObservabilityBudgetRollup;
  retention: ObservabilityRetentionRollup;
}>;

export const WATCHDOG_ALERT_KINDS = [
  "stale_lease",
  "stuck_verifying",
  "repeated_failures",
  "budget_breach",
] as const;

export type WatchdogAlertKind = (typeof WATCHDOG_ALERT_KINDS)[number];

export type WatchdogTaskRow = Readonly<{
  taskId: string;
  state: string;
  /** ISO timestamp while a lease is held, otherwise null. */
  leaseExpiresAt: string | null;
  /** When the task entered VERIFYING, otherwise null. */
  verifyingSince: string | null;
  consecutiveFailures: number;
}>;

/**
 * Thresholds are configuration, never hidden code defaults. `null` means the
 * owner has not configured (or has deferred) that check.
 */
export type WatchdogThresholds = Readonly<{
  staleLeaseSeconds: number | null;
  stuckVerifyingSeconds: number | null;
  consecutiveFailures: number | null;
  /** OD-B7 is pending in B8, so this stays `null` unless supplied. */
  budgetCeilingUsd: number | null;
}>;

export type WatchdogAlert = Readonly<{
  kind: WatchdogAlertKind;
  taskId: string | null;
  /** Display of the explicit configured threshold that fired. */
  threshold: number;
}>;

export type WatchdogReport = Readonly<{
  status: "ok" | "alert" | "unconfigured";
  alerts: readonly WatchdogAlert[];
  /** Checks skipped because their threshold is unconfigured. */
  unconfigured: readonly WatchdogAlertKind[];
  thresholds: WatchdogThresholds;
}>;

export type WatchdogInput = Readonly<{
  now: Date;
  tasks: readonly WatchdogTaskRow[];
  budgetSpentUsd: number;
  thresholds: WatchdogThresholds;
}>;
