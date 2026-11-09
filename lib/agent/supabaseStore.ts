import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isAgentStepStatus, isAgentTaskState } from "./fsm.ts";
import {
  mapAgentEventRow,
  mapAgentTaskStepRow,
  mapAgentTaskRow,
  type AgentEventRow,
  type AgentTaskRow,
  type AgentTaskStepRow,
} from "./rows.ts";
import type {
  AgentTaskStore,
  CancelOutcome,
  ClaimOutcome,
  CreateSessionOutcome,
  CreateTaskOutcome,
  HeartbeatOutcome,
  PlanStepsOutcome,
  ReapOutcome,
  RecordStepOutcome,
  ReleaseOutcome,
  TransitionOutcome,
} from "./store.ts";
import type {
  AgentEvent,
  AgentPlanStep,
  AgentTask,
  AgentTaskStep,
} from "./types.ts";

/**
 * Service-role adapter for the B1 agent tables. Every method maps the reviewed
 * SECURITY DEFINER RPCs (or additive table reads) into the typed fail-closed
 * `AgentTaskStore` contract. No method ever coerces an RPC error into success.
 *
 * This module is server-only and is not wired to any deployment in B1; the
 * worker that will call it does not exist yet.
 */

type RpcRow = Record<string, unknown>;

function firstRow(data: unknown): RpcRow | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const candidate = data[0];
  return typeof candidate === "object" && candidate !== null
    ? (candidate as RpcRow)
    : null;
}

function readText(row: RpcRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readCount(row: RpcRow, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return 0;
}

function stepPayload(task: AgentTask, step: AgentPlanStep) {
  return {
    task_id: task.id,
    workspace_id: task.workspaceId,
    seq: step.seq,
    kind: "mock" as const,
    label: step.label.trim(),
    tool_name: step.toolName,
    tool_version: step.toolVersion,
    args_hash: step.argsHash,
    status: "PENDING" as const,
    attempts: 0,
    idempotency_key: `${task.id}:${step.seq}`,
  };
}

export function createSupabaseAgentStore(service: SupabaseClient): AgentTaskStore {
  async function getTask(taskId: string): Promise<AgentTask | null> {
    const result = await service
      .from("agent_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();
    if (result.error) return null;
    return mapAgentTaskRow(result.data as AgentTaskRow | null);
  }

  async function listSteps(taskId: string): Promise<AgentTaskStep[]> {
    const result = await service
      .from("agent_task_steps")
      .select("*")
      .eq("task_id", taskId)
      .order("seq", { ascending: true });
    if (result.error || !Array.isArray(result.data)) return [];
    return result.data
      .map((row) => mapAgentTaskStepRow(row as AgentTaskStepRow))
      .filter((step): step is AgentTaskStep => step !== null);
  }

  async function insertSteps(
    task: AgentTask,
    plan: readonly AgentPlanStep[],
  ): Promise<AgentTaskStep[] | null> {
    if (plan.length === 0) return [];
    const result = await service
      .from("agent_task_steps")
      .insert(plan.map((step) => stepPayload(task, step)))
      .select("*");
    if (result.error || !Array.isArray(result.data)) return null;
    const mapped = result.data
      .map((row) => mapAgentTaskStepRow(row as AgentTaskStepRow))
      .filter((step): step is AgentTaskStep => step !== null);
    return mapped.length === plan.length ? mapped : null;
  }

  return {
    async createSession(input): Promise<CreateSessionOutcome> {
      const result = await service
        .from("agent_sessions")
        .insert({
          workspace_id: input.workspaceId,
          user_id: input.userId,
          channel: input.channel ?? "console",
          model_policy: input.modelPolicy ?? "mock",
        })
        .select("id")
        .single();
      if (result.error || !result.data || typeof result.data.id !== "string") {
        return { ok: false, reason: "create_session_error" };
      }
      return { ok: true, sessionId: result.data.id };
    },

    async createTask(input): Promise<CreateTaskOutcome> {
      const result = await service
        .from("agent_tasks")
        .insert({
          session_id: input.sessionId,
          workspace_id: input.workspaceId,
          goal: input.goal.trim(),
          deadline_at: input.deadlineAt,
          max_steps: input.maxSteps ?? 25,
          created_by: input.createdBy,
        })
        .select("*")
        .single();
      if (result.error) return { ok: false, reason: "create_task_error" };

      const task = mapAgentTaskRow(result.data as AgentTaskRow | null);
      if (!task) return { ok: false, reason: "create_task_error" };

      const steps = await insertSteps(task, input.steps ?? []);
      if (!steps) return { ok: false, reason: "create_task_error" };

      const appended = await service.rpc("append_agent_event", {
        p_task_id: task.id,
        p_type: "task_created",
        p_payload: { max_steps: task.maxSteps },
      });
      if (appended.error) return { ok: false, reason: "create_task_error" };

      return { ok: true, task, steps };
    },

    async planSteps(taskId, plan): Promise<PlanStepsOutcome> {
      const existing = await listSteps(taskId);
      if (existing.length > 0) return { ok: true, steps: existing };

      const task = await getTask(taskId);
      if (!task) return { ok: false, reason: "plan_error" };
      if (plan.length < 1 || plan.length > task.maxSteps) {
        return { ok: false, reason: "plan_error" };
      }

      const inserted = await insertSteps(task, plan);
      if (inserted) return { ok: true, steps: inserted };

      // A concurrent planner may have won the unique (task_id, seq) race.
      const raced = await listSteps(taskId);
      if (raced.length > 0) return { ok: true, steps: raced };
      return { ok: false, reason: "plan_error" };
    },

    async claimTask(workerId, leaseSeconds): Promise<ClaimOutcome> {
      const result = await service.rpc("claim_agent_task", {
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
      });
      if (result.error) return { ok: false, reason: "claim_error" };

      const row = firstRow(result.data);
      const reason = row ? readText(row, "reason") : null;
      if (!row || !reason) return { ok: false, reason: "claim_error" };

      if (reason === "none") return { ok: false, reason: "none" };
      if (reason === "invalid_worker") {
        return { ok: false, reason: "invalid_worker" };
      }
      if (reason === "invalid_lease") {
        return { ok: false, reason: "invalid_lease" };
      }
      if (reason !== "claimed") return { ok: false, reason: "claim_error" };

      const taskId = readText(row, "task_id");
      const leaseToken = readText(row, "lease_token");
      const leaseExpiresAt = readText(row, "lease_expires_at");
      if (!taskId || !leaseToken || !leaseExpiresAt) {
        return { ok: false, reason: "claim_error" };
      }

      const task = await getTask(taskId);
      if (!task) return { ok: false, reason: "claim_error" };
      return { ok: true, task, leaseToken, leaseExpiresAt };
    },

    async heartbeat(taskId, leaseToken, leaseSeconds): Promise<HeartbeatOutcome> {
      const result = await service.rpc("heartbeat_agent_task", {
        p_task_id: taskId,
        p_lease_token: leaseToken,
        p_lease_seconds: leaseSeconds,
      });
      if (result.error) return { ok: false, reason: "heartbeat_error" };

      const row = firstRow(result.data);
      const reason = row ? readText(row, "reason") : null;
      if (!row || !reason) return { ok: false, reason: "heartbeat_error" };

      if (reason === "extended") {
        const leaseExpiresAt = readText(row, "lease_expires_at");
        if (!leaseExpiresAt) return { ok: false, reason: "heartbeat_error" };
        return {
          ok: true,
          cancelRequested: row.cancel_requested === true,
          leaseExpiresAt,
        };
      }

      switch (reason) {
        case "not_found":
        case "lease_mismatch":
        case "lease_expired":
        case "invalid_lease":
          return { ok: false, reason };
        default:
          return { ok: false, reason: "heartbeat_error" };
      }
    },

    async release(taskId, leaseToken): Promise<ReleaseOutcome> {
      const result = await service.rpc("release_agent_task", {
        p_task_id: taskId,
        p_lease_token: leaseToken,
      });
      if (result.error) return { ok: false, reason: "release_error" };

      const row = firstRow(result.data);
      const reason = row ? readText(row, "reason") : null;
      if (!row || !reason) return { ok: false, reason: "release_error" };

      if (reason === "released") return { ok: true };
      switch (reason) {
        case "not_found":
        case "lease_mismatch":
        case "not_leased":
          return { ok: false, reason };
        default:
          return { ok: false, reason: "release_error" };
      }
    },

    async requestCancel(taskId, actorUserId): Promise<CancelOutcome> {
      const result = await service.rpc("request_agent_task_cancel", {
        p_task_id: taskId,
        p_actor_user_id: actorUserId,
      });
      if (result.error) return { ok: false, reason: "cancel_error" };

      const row = firstRow(result.data);
      const reason = row ? readText(row, "reason") : null;
      const state = row ? readText(row, "state") : null;
      if (!row || !reason) return { ok: false, reason: "cancel_error" };

      if (reason === "requested" || reason === "cancelled") {
        if (!isAgentTaskState(state)) {
          return { ok: false, reason: "cancel_error" };
        }
        return { ok: true, reason, state };
      }

      switch (reason) {
        case "not_found":
        case "not_authorized":
        case "terminal":
        case "already_requested":
          return { ok: false, reason };
        default:
          return { ok: false, reason: "cancel_error" };
      }
    },

    async transition(input): Promise<TransitionOutcome> {
      const result = await service.rpc("transition_agent_task", {
        p_task_id: input.taskId,
        p_lease_token: input.leaseToken,
        p_from_state: input.from,
        p_to_state: input.to,
        p_reason: input.reason ?? null,
        p_evidence: input.evidence ?? {},
      });
      if (result.error) return { ok: false, reason: "transition_error" };

      const row = firstRow(result.data);
      const reason = row ? readText(row, "reason") : null;
      const state = row ? readText(row, "state") : null;
      if (!row || !reason) return { ok: false, reason: "transition_error" };

      if (reason === "transitioned") {
        if (!isAgentTaskState(state)) {
          return { ok: false, reason: "transition_error" };
        }
        return { ok: true, state };
      }

      switch (reason) {
        case "not_found":
        case "lease_mismatch":
        case "lease_expired":
        case "state_mismatch":
        case "invalid_transition":
        case "invalid_state":
        case "cancel_requested":
          return { ok: false, reason };
        default:
          return { ok: false, reason: "transition_error" };
      }
    },

    async recordStep(input): Promise<RecordStepOutcome> {
      const result = await service.rpc("record_agent_step", {
        p_task_id: input.taskId,
        p_lease_token: input.leaseToken,
        p_step_id: input.stepId,
        p_status: input.status,
        p_evidence: input.evidence ?? {},
      });
      if (result.error) return { ok: false, reason: "record_step_error" };

      const row = firstRow(result.data);
      const reason = row ? readText(row, "reason") : null;
      const status = row ? readText(row, "step_status") : null;
      if (!row || !reason) return { ok: false, reason: "record_step_error" };

      if (reason === "recorded") {
        if (!isAgentStepStatus(status)) {
          return { ok: false, reason: "record_step_error" };
        }
        return { ok: true, status };
      }

      switch (reason) {
        case "not_found":
        case "lease_mismatch":
        case "lease_expired":
        case "state_mismatch":
        case "cancel_requested":
        case "step_not_found":
        case "already_completed":
        case "step_terminal":
        case "attempts_exhausted":
        case "invalid_status":
          return { ok: false, reason };
        default:
          return { ok: false, reason: "record_step_error" };
      }
    },

    async reapExpired(): Promise<ReapOutcome> {
      const result = await service.rpc("reap_agent_tasks");
      if (result.error) return { ok: false, reason: "reap_error" };

      const row = firstRow(result.data);
      if (!row) return { ok: false, reason: "reap_error" };
      return {
        ok: true,
        failed: readCount(row, "failed_count"),
        cancelled: readCount(row, "cancelled_count"),
      };
    },

    getTask,
    listSteps,

    async listEvents(
      taskId: string,
      afterSeq: number,
      limit: number,
    ): Promise<AgentEvent[]> {
      const bounded = Math.min(500, Math.max(1, Math.floor(limit)));
      const cursor = Number.isSafeInteger(afterSeq) && afterSeq > 0 ? afterSeq : 0;
      const result = await service
        .from("agent_events")
        .select("*")
        .eq("task_id", taskId)
        .gt("seq", cursor)
        .order("seq", { ascending: true })
        .limit(bounded);
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapAgentEventRow(row as AgentEventRow))
        .filter((event): event is AgentEvent => event !== null);
    },
  };
}
