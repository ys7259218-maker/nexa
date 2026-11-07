/**
 * Phase B B1 agent runtime types.
 *
 * These types describe durable runtime state only. They are deliberately
 * independent of any provider, tool registry, approval engine, or UI surface:
 * B1 executes deterministic mock steps and persists every transition.
 */

export const AGENT_TASK_STATES = [
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

export type AgentTaskState = (typeof AGENT_TASK_STATES)[number];

export const AGENT_TERMINAL_STATES = ["COMPLETE", "FAILED", "CANCELLED"] as const;

export type AgentTerminalState = (typeof AGENT_TERMINAL_STATES)[number];

export const AGENT_STEP_STATUSES = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "CANCELLED",
] as const;

export type AgentStepStatus = (typeof AGENT_STEP_STATUSES)[number];

export const AGENT_STEP_TERMINAL_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "CANCELLED",
] as const;

export const AGENT_EVENT_TYPES = [
  "task_created",
  "task_claimed",
  "task_lease_reclaimed",
  "task_lease_released",
  "task_cancel_requested",
  "task_cancelled",
  "task_transitioned",
  "step_started",
  "step_succeeded",
  "step_failed",
  "step_skipped",
  "step_cancelled",
  "task_failed",
  "task_completed",
] as const;

export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

/** Mirrors the per-workspace cap in `claim_agent_task`. */
export const AGENT_WORKSPACE_CONCURRENT_TASK_CAP = 2;

/** Mirrors the global cap in `claim_agent_task`. */
export const AGENT_GLOBAL_CONCURRENT_TASK_CAP = 20;

export const AGENT_DEFAULT_MAX_STEPS = 25;

export const AGENT_DEFAULT_LEASE_SECONDS = 60;

export const AGENT_MIN_LEASE_SECONDS = 15;

export const AGENT_MAX_LEASE_SECONDS = 300;

export type AgentTask = {
  id: string;
  sessionId: string;
  workspaceId: string;
  goal: string;
  state: AgentTaskState;
  planVersion: number;
  cancelRequested: boolean;
  cancelRequestedAt: string | null;
  deadlineAt: string;
  maxSteps: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastHeartbeatAt: string | null;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  evidence: Record<string, unknown>;
};

export type AgentTaskStep = {
  id: string;
  taskId: string;
  workspaceId: string;
  seq: number;
  kind: "mock";
  label: string;
  toolName: string;
  toolVersion: string;
  argsHash: string;
  status: AgentStepStatus;
  attempts: number;
  idempotencyKey: string;
  evidence: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentEvent = {
  id: string;
  workspaceId: string;
  taskId: string;
  seq: number;
  type: AgentEventType;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPlanStep = {
  seq: number;
  label: string;
  toolName: string;
  toolVersion: string;
  argsHash: string;
};

export type AgentTaskSummary = Pick<
  AgentTask,
  | "id"
  | "workspaceId"
  | "sessionId"
  | "goal"
  | "state"
  | "deadlineAt"
  | "cancelRequested"
  | "failureReason"
  | "createdAt"
  | "updatedAt"
  | "completedAt"
>;
