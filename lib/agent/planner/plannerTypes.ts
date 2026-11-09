/**
 * Phase B B4 planning & orchestration contracts.
 *
 * These types are deliberately independent of any provider, network client,
 * or database driver. B4 planners and stores are deterministic contracts;
 * the planner, gate, packer, scheduler, and checkpoint are the durable
 * pieces. Nothing here calls a model provider, WhatsApp, OAuth, the
 * network, a browser, the filesystem, or any calendar API.
 */

export const PLAN_STATUSES = [
  "draft",
  "approved",
  "executing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STEP_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
] as const;

export type PlanStepStatus = (typeof PLAN_STEP_STATUSES)[number];

export const PLAN_CHECKPOINT_TYPES = ["pre_execution", "post_execution"] as const;

export type PlanCheckpointType = (typeof PLAN_CHECKPOINT_TYPES)[number];

export const PLAN_CHECKPOINT_DECISIONS = ["ALLOW", "CHALLENGE", "DENY"] as const;

export type PlanCheckpointDecision = (typeof PLAN_CHECKPOINT_DECISIONS)[number];

export const PLAN_STEP_CAP_MIN = 1;
export const PLAN_STEP_CAP_MAX = 25;

export const MAX_ATTEMPTS_MIN = 1;
export const MAX_ATTEMPTS_MAX = 3;

export const TIMEOUT_MS_MIN = 1;
export const TIMEOUT_MS_MAX = 600_000;

export type Plan = Readonly<{
  id: string;
  workspaceId: string;
  taskId: string;
  status: PlanStatus;
  stepCap: number;
  stepsCompleted: number;
  contextHash: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}>;

export type PlanStep = Readonly<{
  id: string;
  planId: string;
  seq: number;
  toolName: string;
  toolVersion: string;
  toolFamily: string;
  declaredTier: string;
  riskScore: Record<string, unknown> | null;
  status: PlanStepStatus;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  inputsHash: string;
  outputsHash: string | null;
  errorClass: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PlanCheckpoint = Readonly<{
  id: string;
  planStepId: string;
  checkpointType: PlanCheckpointType;
  decision: PlanCheckpointDecision;
  decisionHash: string;
  checkedAt: string;
  checkedBy: string | null;
}>;

export type PlanEnvironment = Readonly<Record<string, string | undefined>>;

export type PlanGateReason = "enabled" | "flag_off" | "production";

export type PlanGate = {
  enabled: boolean;
  reason: PlanGateReason;
};

export type PlannerOptions = Readonly<{
  store: PlannerStore;
  gate: PlanGate;
  /**
   * True when the workspace automation kill switch is paused for this
   * workspace. Planner returns blocked for all plans when paused.
   */
  workspacePaused: boolean;
  /**
   * Tenant kill switch. When false, the entire planner is dormant.
   */
  tenantKillSwitchEnabled: boolean;
  /**
   * Authorize a plan step through the B3 permission engine. Returns the
   * B3 AuthorizeResult. Content-free: only ids and hashes cross this
   * boundary.
   */
  authorizeStep: (
    workspaceId: string,
    tier: string,
    toolFamily: string,
    riskScore: Record<string, unknown> | null,
    now: Date,
  ) => Promise<{
    decision: "ALLOW" | "CHALLENGE" | "DENY";
    effectiveTier: string;
    requiresApproval: boolean;
    ttlSeconds: number | null;
  }>;
  /**
   * Record a plan checkpoint. Content-free hashes only.
   */
  recordCheckpoint: (
    planStepId: string,
    checkpointType: PlanCheckpointType,
    decision: PlanCheckpointDecision,
    decisionHash: string,
  ) => Promise<void>;
  now?: () => Date;
  idFactory?: () => string;
}>;

export function isPlanStatus(value: unknown): value is PlanStatus {
  return PLAN_STATUSES.includes(value as PlanStatus);
}

export function isPlanStepStatus(value: unknown): value is PlanStepStatus {
  return PLAN_STEP_STATUSES.includes(value as PlanStepStatus);
}

export function isPlanCheckpointType(
  value: unknown,
): value is PlanCheckpointType {
  return PLAN_CHECKPOINT_TYPES.includes(value as PlanCheckpointType);
}

export function isPlanCheckpointDecision(
  value: unknown,
): value is PlanCheckpointDecision {
  return PLAN_CHECKPOINT_DECISIONS.includes(value as PlanCheckpointDecision);
}

export const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

export function isValidStepCap(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= PLAN_STEP_CAP_MIN &&
    value <= PLAN_STEP_CAP_MAX
  );
}

export function isValidMaxAttempts(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MAX_ATTEMPTS_MIN &&
    value <= MAX_ATTEMPTS_MAX
  );
}

export function isValidTimeoutMs(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= TIMEOUT_MS_MIN &&
    value <= TIMEOUT_MS_MAX
  );
}

/**
 * Store outcome type, shared between in-memory and Supabase implementations.
 */
export type StoreOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export type PlannerStore = Readonly<{
  upsertPlan(input: UpsertPlanInput): Promise<StoreOutcome<{ planId: string }>>;
  updatePlanProgress(input: UpdatePlanProgressInput): Promise<StoreOutcome<{ planId: string }>>;
  cancelPlan(input: CancelPlanInput): Promise<StoreOutcome<{ planId: string }>>;
  listPlans(workspaceId: string): Promise<Plan[]>;
  getPlan(planId: string): Promise<Plan | null>;
  recordPlanStep(input: RecordPlanStepInput): Promise<StoreOutcome<{ stepId: string }>>;
  listPlanSteps(planId: string): Promise<PlanStep[]>;
  getPlanStep(stepId: string): Promise<PlanStep | null>;
  recordPlanCheckpoint(input: RecordPlanCheckpointInput): Promise<StoreOutcome<{ checkpointId: string }>>;
  listPlanCheckpoints(planStepId: string): Promise<PlanCheckpoint[]>;
}>;

export type UpsertPlanInput = Readonly<{
  workspaceId: string;
  taskId: string;
  status: PlanStatus;
  stepCap: number;
  stepsCompleted: number | null;
  contextHash: string;
}>;

export type UpdatePlanProgressInput = Readonly<{
  workspaceId: string;
  planId: string;
  stepsCompleted: number;
}>;

export type CancelPlanInput = Readonly<{
  workspaceId: string;
  planId: string;
}>;

export type RecordPlanStepInput = Readonly<{
  workspaceId: string;
  planId: string;
  seq: number;
  toolName: string;
  toolVersion: string;
  toolFamily: string;
  declaredTier: string;
  riskScore: Record<string, unknown> | null;
  status: PlanStepStatus;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  inputsHash: string;
  outputsHash: string | null;
  errorClass: string | null;
  startedAt: string | null;
  completedAt: string | null;
}>;

export type RecordPlanCheckpointInput = Readonly<{
  workspaceId: string;
  planStepId: string;
  checkpointType: PlanCheckpointType;
  decision: PlanCheckpointDecision;
  decisionHash: string;
}>;
