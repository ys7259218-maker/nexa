/**
 * Phase B B4 Supabase store for planning & orchestration tables.
 *
 * Server-only adapter. Every write maps to a reviewed SECURITY DEFINER RPC
 * from migration `20261109030000_planning_orchestration_b4.sql`. Read
 * paths use RLS-scoped selects. Content-free hashes only — never raw content
 * or plaintext secrets.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Plan,
  PlanCheckpoint,
  PlanStep,
  StoreOutcome,
} from "./plannerTypes.ts";

type RpcRow = Record<string, unknown>;

export type SupabasePlannerStore = Readonly<{
  upsertPlan(input: {
    workspaceId: string;
    taskId: string;
    status: string;
    stepCap: number;
    stepsCompleted: number | null;
    contextHash: string;
  }): Promise<StoreOutcome<{ planId: string }>>;
  updatePlanProgress(input: {
    workspaceId: string;
    planId: string;
    stepsCompleted: number;
  }): Promise<StoreOutcome<{ planId: string }>>;
  cancelPlan(input: {
    workspaceId: string;
    planId: string;
  }): Promise<StoreOutcome<{ planId: string }>>;
  listPlans(workspaceId: string): Promise<Plan[]>;
  getPlan(planId: string): Promise<Plan | null>;

  recordPlanStep(input: {
    workspaceId: string;
    planId: string;
    seq: number;
    toolName: string;
    toolVersion: string;
    toolFamily: string;
    declaredTier: string;
    riskScore: Record<string, unknown> | null;
    status: string;
    attempts: number;
    maxAttempts: number;
    timeoutMs: number;
    inputsHash: string;
    outputsHash: string | null;
    errorClass: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }): Promise<StoreOutcome<{ stepId: string }>>;
  listPlanSteps(planId: string): Promise<PlanStep[]>;
  getPlanStep(stepId: string): Promise<PlanStep | null>;

  recordPlanCheckpoint(input: {
    workspaceId: string;
    planStepId: string;
    checkpointType: string;
    decision: string;
    decisionHash: string;
  }): Promise<StoreOutcome<{ checkpointId: string }>>;
  listPlanCheckpoints(planStepId: string): Promise<PlanCheckpoint[]>;
}>;

function firstRow(data: unknown): RpcRow | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  return typeof data[0] === "object" && data[0] !== null
    ? (data[0] as RpcRow)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapPlanRow(row: unknown): Plan | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const taskId = asText(r.task_id);
  const status = r.status;
  const stepCap = asInteger(r.step_cap);
  const stepsCompleted = asInteger(r.steps_completed);
  const contextHash = asText(r.context_hash);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);
  const completedAt = r.completed_at === null ? null : asIso(r.completed_at);

  if (
    !id ||
    !workspaceId ||
    !taskId ||
    (status !== "draft" &&
      status !== "approved" &&
      status !== "executing" &&
      status !== "completed" &&
      status !== "failed" &&
      status !== "cancelled") ||
    stepCap === null ||
    stepsCompleted === null ||
    !contextHash ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    taskId,
    status: status as Plan["status"],
    stepCap,
    stepsCompleted,
    contextHash,
    createdAt,
    updatedAt,
    completedAt,
  };
}

function mapPlanStepRow(row: unknown): PlanStep | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const planId = asText(r.plan_id);
  const seq = asInteger(r.seq);
  const toolName = asText(r.tool_name);
  const toolVersion = asText(r.tool_version);
  const toolFamily = asText(r.tool_family);
  const declaredTier = r.declared_tier;
  const riskScore = r.risk_score === null ? null : (r.risk_score as Record<string, unknown>);
  const status = r.status;
  const attempts = asInteger(r.attempts);
  const maxAttempts = asInteger(r.max_attempts);
  const timeoutMs = asInteger(r.timeout_ms);
  const inputsHash = asText(r.inputs_hash);
  const outputsHash = r.outputs_hash === null ? null : asText(r.outputs_hash);
  const errorClass = r.error_class === null ? null : asText(r.error_class);
  const startedAt = r.started_at === null ? null : asIso(r.started_at);
  const completedAt = r.completed_at === null ? null : asIso(r.completed_at);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);

  if (
    !id ||
    !planId ||
    seq === null ||
    !toolName ||
    !toolVersion ||
    !toolFamily ||
    (declaredTier !== "T0" &&
      declaredTier !== "T1" &&
      declaredTier !== "T2" &&
      declaredTier !== "T3" &&
      declaredTier !== "T4" &&
      declaredTier !== "T5") ||
    (status !== "pending" &&
      status !== "running" &&
      status !== "succeeded" &&
      status !== "failed" &&
      status !== "skipped" &&
      status !== "cancelled") ||
    attempts === null ||
    maxAttempts === null ||
    timeoutMs === null ||
    !inputsHash ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    planId,
    seq,
    toolName,
    toolVersion,
    toolFamily,
    declaredTier: declaredTier as PlanStep["declaredTier"],
    riskScore,
    status: status as PlanStep["status"],
    attempts,
    maxAttempts,
    timeoutMs,
    inputsHash,
    outputsHash,
    errorClass,
    startedAt,
    completedAt,
    createdAt,
    updatedAt,
  };
}

function mapPlanCheckpointRow(row: unknown): PlanCheckpoint | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const planStepId = asText(r.plan_step_id);
  const checkpointType = r.checkpoint_type;
  const decision = r.decision;
  const decisionHash = asText(r.decision_hash);
  const checkedAt = asIso(r.checked_at);
  const checkedBy = r.checked_by === null ? null : asText(r.checked_by);

  if (
    !id ||
    !planStepId ||
    (checkpointType !== "pre_execution" && checkpointType !== "post_execution") ||
    (decision !== "ALLOW" && decision !== "CHALLENGE" && decision !== "DENY") ||
    !decisionHash ||
    !checkedAt
  ) {
    return null;
  }

  return {
    id,
    planStepId,
    checkpointType: checkpointType as PlanCheckpoint["checkpointType"],
    decision: decision as PlanCheckpoint["decision"],
    decisionHash,
    checkedAt,
    checkedBy,
  };
}

export function createSupabasePlannerStore(
  service: SupabaseClient,
): SupabasePlannerStore {
  return {
    async upsertPlan(input) {
      const result = await service.rpc("upsert_agent_plan", {
        p_workspace_id: input.workspaceId,
        p_task_id: input.taskId,
        p_status: input.status,
        p_step_cap: input.stepCap,
        p_steps_completed: input.stepsCompleted ?? null,
        p_context_hash: input.contextHash,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.plan_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, value: { planId: id } };
    },

    async updatePlanProgress(input) {
      const result = await service.rpc("update_agent_plan_progress", {
        p_workspace_id: input.workspaceId,
        p_plan_id: input.planId,
        p_steps_completed: input.stepsCompleted,
      });
      if (result.error) return { ok: false, reason: "update_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.plan_id) : null;
      if (reason !== "updated" || !id) {
        return { ok: false, reason: reason ?? "update_rejected" };
      }
      return { ok: true, value: { planId: id } };
    },

    async cancelPlan(input) {
      const result = await service.rpc("cancel_agent_plan", {
        p_workspace_id: input.workspaceId,
        p_plan_id: input.planId,
      });
      if (result.error) return { ok: false, reason: "cancel_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.plan_id) : null;
      if (reason !== "cancelled" || !id) {
        return { ok: false, reason: reason ?? "cancel_rejected" };
      }
      return { ok: true, value: { planId: id } };
    },

    async listPlans(workspaceId) {
      const result = await service
        .from("agent_plans")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapPlanRow(row))
        .filter((row): row is Plan => row !== null);
    },

    async getPlan(planId) {
      const result = await service
        .from("agent_plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return mapPlanRow(result.data);
    },

    async recordPlanStep(input) {
      const result = await service.rpc("record_agent_plan_step", {
        p_workspace_id: input.workspaceId,
        p_plan_id: input.planId,
        p_seq: input.seq,
        p_tool_name: input.toolName,
        p_tool_version: input.toolVersion,
        p_tool_family: input.toolFamily,
        p_declared_tier: input.declaredTier,
        p_risk_score: input.riskScore,
        p_status: input.status,
        p_attempts: input.attempts,
        p_max_attempts: input.maxAttempts,
        p_timeout_ms: input.timeoutMs,
        p_inputs_hash: input.inputsHash,
        p_outputs_hash: input.outputsHash,
        p_error_class: input.errorClass,
        p_started_at: input.startedAt,
        p_completed_at: input.completedAt,
      });
      if (result.error) return { ok: false, reason: "record_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.step_id) : null;
      if (reason !== "recorded" || !id) {
        return { ok: false, reason: reason ?? "record_rejected" };
      }
      return { ok: true, value: { stepId: id } };
    },

    async listPlanSteps(planId) {
      const result = await service
        .from("agent_plan_steps")
        .select("*")
        .eq("plan_id", planId)
        .order("seq", { ascending: true });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapPlanStepRow(row))
        .filter((row): row is PlanStep => row !== null);
    },

    async getPlanStep(stepId) {
      const result = await service
        .from("agent_plan_steps")
        .select("*")
        .eq("id", stepId)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return mapPlanStepRow(result.data);
    },

    async recordPlanCheckpoint(input) {
      const result = await service.rpc("record_agent_plan_checkpoint", {
        p_workspace_id: input.workspaceId,
        p_plan_step_id: input.planStepId,
        p_checkpoint_type: input.checkpointType,
        p_decision: input.decision,
        p_decision_hash: input.decisionHash,
      });
      if (result.error) return { ok: false, reason: "record_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.checkpoint_id) : null;
      if (reason !== "recorded" || !id) {
        return { ok: false, reason: reason ?? "record_rejected" };
      }
      return { ok: true, value: { checkpointId: id } };
    },

    async listPlanCheckpoints(planStepId) {
      const result = await service
        .from("agent_plan_checkpoints")
        .select("*")
        .eq("plan_step_id", planStepId)
        .order("checked_at", { ascending: false });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapPlanCheckpointRow(row))
        .filter((row): row is PlanCheckpoint => row !== null);
    },
  };
}
