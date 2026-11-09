import { isAgentStepStatus, isAgentTaskState } from "./fsm.ts";
import {
  AGENT_EVENT_TYPES,
  type AgentEvent,
  type AgentEventType,
  type AgentTask,
  type AgentTaskStep,
} from "./types.ts";

/**
 * Fail-closed row mapping for the four `agent_*` tables. PostgREST returns
 * snake_case columns; every runtime/UI path converts through these functions
 * and treats an unrecognized state, status, event type, or malformed timestamp
 * as "no row" rather than guessing.
 */

export type AgentTaskRow = {
  id?: unknown;
  session_id?: unknown;
  workspace_id?: unknown;
  goal?: unknown;
  state?: unknown;
  plan_version?: unknown;
  cancel_requested?: unknown;
  cancel_requested_at?: unknown;
  deadline_at?: unknown;
  max_steps?: unknown;
  created_by?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  last_heartbeat_at?: unknown;
  lease_token?: unknown;
  lease_expires_at?: unknown;
  completed_at?: unknown;
  failure_reason?: unknown;
  evidence?: unknown;
};

export type AgentTaskStepRow = {
  id?: unknown;
  task_id?: unknown;
  workspace_id?: unknown;
  seq?: unknown;
  kind?: unknown;
  label?: unknown;
  tool_name?: unknown;
  tool_version?: unknown;
  args_hash?: unknown;
  status?: unknown;
  attempts?: unknown;
  idempotency_key?: unknown;
  evidence?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type AgentEventRow = {
  id?: unknown;
  workspace_id?: unknown;
  task_id?: unknown;
  seq?: unknown;
  type?: unknown;
  payload?: unknown;
  created_at?: unknown;
};

const ARGS_HASH_PATTERN = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export function isAgentEventType(value: unknown): value is AgentEventType {
  return AGENT_EVENT_TYPES.includes(value as AgentEventType);
}

export function mapAgentTaskRow(row: AgentTaskRow | null | undefined): AgentTask | null {
  if (!row) return null;
  if (!isAgentTaskState(row.state)) return null;

  const id = asText(row.id);
  const sessionId = asText(row.session_id);
  const workspaceId = asText(row.workspace_id);
  const createdBy = asText(row.created_by);
  const createdAt = asIso(row.created_at);
  const updatedAt = asIso(row.updated_at);
  const deadlineAt = asIso(row.deadline_at);
  const planVersion = asInteger(row.plan_version);
  const maxSteps = asInteger(row.max_steps);

  if (
    !id ||
    !sessionId ||
    !workspaceId ||
    !createdBy ||
    !createdAt ||
    !updatedAt ||
    !deadlineAt ||
    planVersion === null ||
    planVersion < 1 ||
    maxSteps === null ||
    maxSteps < 1 ||
    maxSteps > 25 ||
    typeof row.goal !== "string" ||
    row.goal.trim().length < 1 ||
    row.goal.length > 2000
  ) {
    return null;
  }

  return {
    id,
    sessionId,
    workspaceId,
    goal: row.goal,
    state: row.state,
    planVersion,
    cancelRequested: row.cancel_requested === true,
    cancelRequestedAt: asIso(row.cancel_requested_at),
    deadlineAt,
    maxSteps,
    createdBy,
    createdAt,
    updatedAt,
    lastHeartbeatAt: asIso(row.last_heartbeat_at),
    leaseToken: asText(row.lease_token),
    leaseExpiresAt: asIso(row.lease_expires_at),
    completedAt: asIso(row.completed_at),
    failureReason: asText(row.failure_reason),
    evidence: asRecord(row.evidence),
  };
}

export function mapAgentTaskStepRow(
  row: AgentTaskStepRow | null | undefined,
): AgentTaskStep | null {
  if (!row) return null;
  if (row.kind !== "mock" || !isAgentStepStatus(row.status)) return null;

  const id = asText(row.id);
  const taskId = asText(row.task_id);
  const workspaceId = asText(row.workspace_id);
  const seq = asInteger(row.seq);
  const label = asText(row.label);
  const toolName = asText(row.tool_name);
  const toolVersion = asText(row.tool_version);
  const argsHash = asText(row.args_hash);
  const attempts = asInteger(row.attempts);
  const idempotencyKey = asText(row.idempotency_key);
  const createdAt = asIso(row.created_at);
  const updatedAt = asIso(row.updated_at);

  if (
    !id ||
    !taskId ||
    !workspaceId ||
    seq === null ||
    seq < 1 ||
    seq > 100 ||
    !label ||
    !toolName ||
    !toolVersion ||
    !argsHash ||
    !ARGS_HASH_PATTERN.test(argsHash) ||
    attempts === null ||
    attempts < 0 ||
    attempts > 5 ||
    !idempotencyKey ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    taskId,
    workspaceId,
    seq,
    kind: "mock",
    label,
    toolName,
    toolVersion,
    argsHash,
    status: row.status,
    attempts,
    idempotencyKey,
    evidence: asRecord(row.evidence),
    startedAt: asIso(row.started_at),
    completedAt: asIso(row.completed_at),
    createdAt,
    updatedAt,
  };
}

export function mapAgentEventRow(row: AgentEventRow | null | undefined): AgentEvent | null {
  if (!row) return null;
  if (!isAgentEventType(row.type)) return null;

  const id = asText(row.id);
  const workspaceId = asText(row.workspace_id);
  const taskId = asText(row.task_id);
  const seq = asInteger(row.seq);
  const createdAt = asIso(row.created_at);

  if (!id || !workspaceId || !taskId || seq === null || seq < 1 || !createdAt) {
    return null;
  }

  return {
    id,
    workspaceId,
    taskId,
    seq,
    type: row.type,
    payload: asRecord(row.payload),
    createdAt,
  };
}
