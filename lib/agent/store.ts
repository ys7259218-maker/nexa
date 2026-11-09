import { randomUUID } from "node:crypto";

import {
  AGENT_GLOBAL_CONCURRENT_TASK_CAP,
  AGENT_WORKSPACE_CONCURRENT_TASK_CAP,
  type AgentEvent,
  type AgentEventType,
  type AgentPlanStep,
  type AgentStepStatus,
  type AgentTask,
  type AgentTaskState,
  type AgentTaskStep,
} from "./types.ts";
import {
  AGENT_RUNNABLE_STATES,
  canTransition,
  isTerminalState,
} from "./fsm.ts";

export type CreateSessionInput = {
  workspaceId: string;
  userId: string;
  channel?: "console";
  modelPolicy?: "mock";
};

export type CreateSessionOutcome =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "create_session_error" };

export type CreateTaskInput = {
  sessionId: string;
  workspaceId: string;
  createdBy: string;
  goal: string;
  deadlineAt: string;
  maxSteps?: number;
  steps?: AgentPlanStep[];
};

export type CreateTaskOutcome =
  | { ok: true; task: AgentTask; steps: AgentTaskStep[] }
  | { ok: false; reason: "create_task_error" };

export type PlanStepsOutcome =
  | { ok: true; steps: AgentTaskStep[] }
  | { ok: false; reason: "plan_error" };

export type ClaimOutcome =
  | { ok: true; task: AgentTask; leaseToken: string; leaseExpiresAt: string }
  | { ok: false; reason: "none" | "invalid_worker" | "invalid_lease" | "claim_error" };

export type HeartbeatOutcome =
  | { ok: true; cancelRequested: boolean; leaseExpiresAt: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "lease_mismatch"
        | "lease_expired"
        | "invalid_lease"
        | "heartbeat_error";
    };

export type ReleaseOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "not_found" | "lease_mismatch" | "not_leased" | "release_error";
    };

export type CancelOutcome =
  | { ok: true; reason: "requested" | "cancelled"; state: AgentTaskState }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_authorized"
        | "terminal"
        | "already_requested"
        | "cancel_error";
    };

export type TransitionInput = {
  taskId: string;
  leaseToken: string;
  from: AgentTaskState;
  to: AgentTaskState;
  reason?: string;
  evidence?: Record<string, unknown>;
};

export type TransitionOutcome =
  | { ok: true; state: AgentTaskState }
  | {
      ok: false;
      reason:
        | "not_found"
        | "lease_mismatch"
        | "lease_expired"
        | "state_mismatch"
        | "invalid_transition"
        | "invalid_state"
        | "cancel_requested"
        | "transition_error";
    };

export type RecordStepInput = {
  taskId: string;
  leaseToken: string;
  stepId: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED" | "CANCELLED";
  evidence?: Record<string, unknown>;
};

export type RecordStepOutcome =
  | { ok: true; status: AgentStepStatus }
  | {
      ok: false;
      reason:
        | "not_found"
        | "lease_mismatch"
        | "lease_expired"
        | "state_mismatch"
        | "cancel_requested"
        | "step_not_found"
        | "already_completed"
        | "step_terminal"
        | "attempts_exhausted"
        | "invalid_status"
        | "record_step_error";
    };

export type ReapOutcome =
  | { ok: true; failed: number; cancelled: number }
  | { ok: false; reason: "reap_error" };

export interface AgentTaskStore {
  createSession(input: CreateSessionInput): Promise<CreateSessionOutcome>;
  createTask(input: CreateTaskInput): Promise<CreateTaskOutcome>;
  planSteps(taskId: string, steps: AgentPlanStep[]): Promise<PlanStepsOutcome>;
  claimTask(workerId: string, leaseSeconds: number): Promise<ClaimOutcome>;
  heartbeat(
    taskId: string,
    leaseToken: string,
    leaseSeconds: number,
  ): Promise<HeartbeatOutcome>;
  release(taskId: string, leaseToken: string): Promise<ReleaseOutcome>;
  requestCancel(taskId: string, actorUserId: string): Promise<CancelOutcome>;
  transition(input: TransitionInput): Promise<TransitionOutcome>;
  recordStep(input: RecordStepInput): Promise<RecordStepOutcome>;
  reapExpired(now?: Date): Promise<ReapOutcome>;
  getTask(taskId: string): Promise<AgentTask | null>;
  listSteps(taskId: string): Promise<AgentTaskStep[]>;
  listEvents(taskId: string, afterSeq: number, limit: number): Promise<AgentEvent[]>;
}

export type AgentWorkspaceRole = "owner" | "admin" | "operator" | "viewer";

export type InMemoryAgentStoreOptions = {
  now?: () => Date;
  workspaceRoles?: Record<string, Record<string, AgentWorkspaceRole>>;
  workspaceCap?: number;
  globalCap?: number;
};

export type InMemoryAgentStore = AgentTaskStore & {
  snapshot(): {
    tasks: AgentTask[];
    steps: AgentTaskStep[];
    events: AgentEvent[];
  };
};

type AgentSessionRow = {
  id: string;
  workspaceId: string;
  userId: string;
  channel: "console";
  modelPolicy: "mock";
  status: "active" | "closed";
  createdAt: string;
  lastActiveAt: string;
};

const ARGS_HASH_PATTERN = /^[0-9a-f]{64}$/;

function cloneTask(task: AgentTask): AgentTask {
  return { ...task, evidence: { ...task.evidence } };
}

function cloneStep(step: AgentTaskStep): AgentTaskStep {
  return { ...step, evidence: { ...step.evidence } };
}

function cloneEvent(event: AgentEvent): AgentEvent {
  return { ...event, payload: { ...event.payload } };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeDeadline(value: string): string | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function isValidPlanStep(step: AgentPlanStep): boolean {
  return (
    Number.isInteger(step.seq) &&
    step.seq >= 1 &&
    step.seq <= 100 &&
    step.label.trim().length >= 1 &&
    step.label.trim().length <= 200 &&
    step.toolName.length >= 1 &&
    step.toolName.length <= 80 &&
    step.toolVersion.length >= 1 &&
    step.toolVersion.length <= 40 &&
    ARGS_HASH_PATTERN.test(step.argsHash)
  );
}

/**
 * Deterministic in-memory implementation used by offline tests and local
 * drills. It mirrors the SQL RPC semantics: lease tokens, caps, idempotent
 * steps, append-only events, cooperative cancel, and deadline reaping.
 */
export function createInMemoryAgentStore(
  options: InMemoryAgentStoreOptions = {},
): InMemoryAgentStore {
  const now = options.now ?? (() => new Date());
  const workspaceCap = options.workspaceCap ?? AGENT_WORKSPACE_CONCURRENT_TASK_CAP;
  const globalCap = options.globalCap ?? AGENT_GLOBAL_CONCURRENT_TASK_CAP;
  const workspaceRoles = options.workspaceRoles ?? {};

  const sessions = new Map<string, AgentSessionRow>();
  const tasks = new Map<string, AgentTask>();
  const steps = new Map<string, AgentTaskStep>();
  const events = new Map<string, AgentEvent>();

  function timestamp(): string {
    return now().toISOString();
  }

  function leaseIsActive(task: AgentTask, at: Date): boolean {
    return (
      task.leaseToken !== null &&
      task.leaseExpiresAt !== null &&
      Date.parse(task.leaseExpiresAt) > at.getTime()
    );
  }

  function stepsFor(taskId: string): AgentTaskStep[] {
    return [...steps.values()]
      .filter((step) => step.taskId === taskId)
      .sort((left, right) => left.seq - right.seq);
  }

  function eventsFor(taskId: string): AgentEvent[] {
    return [...events.values()]
      .filter((event) => event.taskId === taskId)
      .sort((left, right) => left.seq - right.seq);
  }

  function appendEvent(
    taskId: string,
    type: AgentEventType,
    payload: Record<string, unknown> = {},
  ): AgentEvent {
    const task = tasks.get(taskId);
    if (!task) throw new Error("agent task not found");
    const nextSeq =
      eventsFor(taskId).reduce((max, event) => Math.max(max, event.seq), 0) + 1;
    const event: AgentEvent = {
      id: randomUUID(),
      workspaceId: task.workspaceId,
      taskId,
      seq: nextSeq,
      type,
      payload: { ...payload },
      createdAt: timestamp(),
    };
    events.set(event.id, event);
    return event;
  }

  function insertSteps(task: AgentTask, plan: readonly AgentPlanStep[]): AgentTaskStep[] {
    const created: AgentTaskStep[] = [];
    for (const entry of plan) {
      const step: AgentTaskStep = {
        id: randomUUID(),
        taskId: task.id,
        workspaceId: task.workspaceId,
        seq: entry.seq,
        kind: "mock",
        label: entry.label.trim(),
        toolName: entry.toolName,
        toolVersion: entry.toolVersion,
        argsHash: entry.argsHash,
        status: "PENDING",
        attempts: 0,
        idempotencyKey: `${task.id}:${entry.seq}`,
        evidence: {},
        startedAt: null,
        completedAt: null,
        createdAt: timestamp(),
        updatedAt: timestamp(),
      };
      steps.set(step.id, step);
      created.push(cloneStep(step));
    }
    return created;
  }

  const store: InMemoryAgentStore = {
    async createSession(input) {
      if (!isUuid(input.workspaceId) || !isUuid(input.userId)) {
        return { ok: false, reason: "create_session_error" };
      }
      const at = timestamp();
      const session: AgentSessionRow = {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        userId: input.userId,
        channel: input.channel ?? "console",
        modelPolicy: input.modelPolicy ?? "mock",
        status: "active",
        createdAt: at,
        lastActiveAt: at,
      };
      sessions.set(session.id, session);
      return { ok: true, sessionId: session.id };
    },

    async createTask(input) {
      const session = sessions.get(input.sessionId);
      if (
        !session ||
        session.workspaceId !== input.workspaceId ||
        !isUuid(input.createdBy)
      ) {
        return { ok: false, reason: "create_task_error" };
      }
      const goal = input.goal.trim();
      const deadlineAt = normalizeDeadline(input.deadlineAt);
      const maxSteps = input.maxSteps ?? 25;
      const createdAt = timestamp();
      if (
        goal.length < 1 ||
        goal.length > 2000 ||
        !deadlineAt ||
        Date.parse(deadlineAt) <= Date.parse(createdAt) ||
        !Number.isInteger(maxSteps) ||
        maxSteps < 1 ||
        maxSteps > 25
      ) {
        return { ok: false, reason: "create_task_error" };
      }
      const plan = input.steps ?? [];
      if (plan.length > maxSteps) {
        return { ok: false, reason: "create_task_error" };
      }
      const seen = new Set<number>();
      for (const entry of plan) {
        if (!isValidPlanStep(entry) || seen.has(entry.seq)) {
          return { ok: false, reason: "create_task_error" };
        }
        seen.add(entry.seq);
      }

      const task: AgentTask = {
        id: randomUUID(),
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        goal,
        state: "INTAKE",
        planVersion: 1,
        cancelRequested: false,
        cancelRequestedAt: null,
        deadlineAt,
        maxSteps,
        createdBy: input.createdBy,
        createdAt,
        updatedAt: createdAt,
        lastHeartbeatAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
        completedAt: null,
        failureReason: null,
        evidence: {},
      };
      tasks.set(task.id, task);
      const createdSteps = plan.length > 0 ? insertSteps(task, plan) : [];
      appendEvent(task.id, "task_created", { max_steps: maxSteps });
      return { ok: true, task: cloneTask(task), steps: createdSteps };
    },

    async planSteps(taskId, plan) {
      const task = tasks.get(taskId);
      if (!task) return { ok: false, reason: "plan_error" };
      const existing = stepsFor(taskId);
      if (existing.length > 0) {
        return { ok: true, steps: existing.map(cloneStep) };
      }
      if (plan.length < 1 || plan.length > task.maxSteps) {
        return { ok: false, reason: "plan_error" };
      }
      const seen = new Set<number>();
      for (const entry of plan) {
        if (!isValidPlanStep(entry) || seen.has(entry.seq)) {
          return { ok: false, reason: "plan_error" };
        }
        seen.add(entry.seq);
      }
      return { ok: true, steps: insertSteps(task, plan) };
    },

    async claimTask(workerId, leaseSeconds) {
      const trimmedWorker = workerId.trim();
      if (trimmedWorker.length < 1 || trimmedWorker.length > 120) {
        return { ok: false, reason: "invalid_worker" };
      }
      if (
        !Number.isInteger(leaseSeconds) ||
        leaseSeconds < 15 ||
        leaseSeconds > 300
      ) {
        return { ok: false, reason: "invalid_lease" };
      }

      const at = now();
      const candidates = [...tasks.values()]
        .filter(
          (task) =>
            AGENT_RUNNABLE_STATES.includes(task.state) &&
            !task.cancelRequested &&
            Date.parse(task.deadlineAt) > at.getTime() &&
            !leaseIsActive(task, at),
        )
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

      const selected = candidates.find((task) => {
        const workspaceActive = [...tasks.values()].filter(
          (other) =>
            other.id !== task.id &&
            other.workspaceId === task.workspaceId &&
            leaseIsActive(other, at),
        ).length;
        const globalActive = [...tasks.values()].filter(
          (other) => other.id !== task.id && leaseIsActive(other, at),
        ).length;
        return workspaceActive < workspaceCap && globalActive < globalCap;
      });

      if (!selected) return { ok: false, reason: "none" };

      const previousLease = selected.leaseToken;
      const leaseToken = randomUUID();
      const leaseExpiresAt = new Date(
        at.getTime() + leaseSeconds * 1000,
      ).toISOString();
      selected.leaseToken = leaseToken;
      selected.leaseExpiresAt = leaseExpiresAt;
      selected.lastHeartbeatAt = at.toISOString();
      selected.updatedAt = at.toISOString();

      let requeued = 0;
      for (const step of stepsFor(selected.id)) {
        if (step.status === "RUNNING") {
          step.status = "PENDING";
          step.startedAt = null;
          step.updatedAt = at.toISOString();
          requeued += 1;
        }
      }

      if (previousLease !== null) {
        appendEvent(selected.id, "task_lease_reclaimed", {
          worker_id: trimmedWorker,
          requeued_steps: requeued,
        });
      }
      appendEvent(selected.id, "task_claimed", { worker_id: trimmedWorker });

      return {
        ok: true,
        task: cloneTask(selected),
        leaseToken,
        leaseExpiresAt,
      };
    },

    async heartbeat(taskId, leaseToken, leaseSeconds) {
      if (
        !Number.isInteger(leaseSeconds) ||
        leaseSeconds < 15 ||
        leaseSeconds > 300
      ) {
        return { ok: false, reason: "invalid_lease" };
      }
      const task = tasks.get(taskId);
      if (!task) return { ok: false, reason: "not_found" };
      if (task.leaseToken !== leaseToken) {
        return { ok: false, reason: "lease_mismatch" };
      }
      const at = now();
      if (!leaseIsActive(task, at)) {
        return { ok: false, reason: "lease_expired" };
      }
      task.leaseExpiresAt = new Date(
        at.getTime() + leaseSeconds * 1000,
      ).toISOString();
      task.lastHeartbeatAt = at.toISOString();
      task.updatedAt = at.toISOString();
      return {
        ok: true,
        cancelRequested: task.cancelRequested,
        leaseExpiresAt: task.leaseExpiresAt,
      };
    },

    async release(taskId, leaseToken) {
      const task = tasks.get(taskId);
      if (!task) return { ok: false, reason: "not_found" };
      if (task.leaseToken === null) return { ok: false, reason: "not_leased" };
      if (task.leaseToken !== leaseToken) {
        return { ok: false, reason: "lease_mismatch" };
      }
      task.leaseToken = null;
      task.leaseExpiresAt = null;
      task.updatedAt = timestamp();
      appendEvent(task.id, "task_lease_released", { state: task.state });
      return { ok: true };
    },

    async requestCancel(taskId, actorUserId) {
      const task = tasks.get(taskId);
      if (!task) return { ok: false, reason: "not_found" };
      const role = workspaceRoles[task.workspaceId]?.[actorUserId];
      const authorized =
        task.createdBy === actorUserId ||
        role === "owner" ||
        role === "admin" ||
        role === "operator";
      if (!authorized) return { ok: false, reason: "not_authorized" };
      if (isTerminalState(task.state)) return { ok: false, reason: "terminal" };
      if (task.cancelRequested) {
        return { ok: false, reason: "already_requested" };
      }

      const at = now();
      task.cancelRequested = true;
      task.cancelRequestedAt = at.toISOString();
      task.updatedAt = at.toISOString();

      if (leaseIsActive(task, at)) {
        appendEvent(task.id, "task_cancel_requested", {
          actor_user_id: actorUserId,
        });
        return { ok: true, reason: "requested", state: task.state };
      }

      task.state = "CANCELLED";
      task.completedAt = at.toISOString();
      task.evidence = { ...task.evidence, reason: "user_requested" };
      task.leaseToken = null;
      task.leaseExpiresAt = null;
      appendEvent(task.id, "task_cancelled", {
        reason: "user_requested",
        actor_user_id: actorUserId,
      });
      return { ok: true, reason: "cancelled", state: "CANCELLED" };
    },

    async transition(input) {
      const task = tasks.get(input.taskId);
      if (!task) return { ok: false, reason: "not_found" };
      if (task.leaseToken !== input.leaseToken) {
        return { ok: false, reason: "lease_mismatch" };
      }
      const at = now();
      if (!leaseIsActive(task, at)) {
        return { ok: false, reason: "lease_expired" };
      }
      if (task.state !== input.from) {
        return { ok: false, reason: "state_mismatch" };
      }
      if (!canTransition(input.from, input.to)) {
        return { ok: false, reason: "invalid_transition" };
      }
      if (task.cancelRequested && input.to !== "CANCELLED" && input.to !== "FAILED") {
        return { ok: false, reason: "cancel_requested" };
      }

      const terminal = isTerminalState(input.to);
      task.state = input.to;
      task.updatedAt = at.toISOString();
      task.completedAt = terminal ? at.toISOString() : null;
      task.failureReason =
        input.to === "FAILED"
          ? (input.reason?.trim().slice(0, 120) || "failed")
          : null;
      task.evidence = { ...task.evidence, ...(input.evidence ?? {}) };
      if (terminal) {
        task.leaseToken = null;
        task.leaseExpiresAt = null;
      }

      if (input.to === "COMPLETE") {
        appendEvent(task.id, "task_completed", {
          from_state: input.from,
          to_state: input.to,
        });
      } else if (input.to === "FAILED") {
        appendEvent(task.id, "task_failed", {
          from_state: input.from,
          reason: task.failureReason,
        });
      } else {
        appendEvent(task.id, "task_transitioned", {
          from_state: input.from,
          to_state: input.to,
        });
      }

      return { ok: true, state: input.to };
    },

    async recordStep(input) {
      const task = tasks.get(input.taskId);
      if (!task) return { ok: false, reason: "not_found" };
      if (task.leaseToken !== input.leaseToken) {
        return { ok: false, reason: "lease_mismatch" };
      }
      const at = now();
      if (!leaseIsActive(task, at)) {
        return { ok: false, reason: "lease_expired" };
      }
      if (task.state !== "EXECUTING") {
        return { ok: false, reason: "state_mismatch" };
      }
      if (
        task.cancelRequested &&
        input.status !== "FAILED" &&
        input.status !== "CANCELLED"
      ) {
        return { ok: false, reason: "cancel_requested" };
      }
      const step = steps.get(input.stepId);
      if (!step || step.taskId !== input.taskId) {
        return { ok: false, reason: "step_not_found" };
      }
      if (step.status === "SUCCEEDED") {
        return { ok: false, reason: "already_completed" };
      }
      if (
        step.status === "FAILED" ||
        step.status === "SKIPPED" ||
        step.status === "CANCELLED"
      ) {
        return { ok: false, reason: "step_terminal" };
      }
      if (input.status === "RUNNING" && step.attempts >= 5) {
        return { ok: false, reason: "attempts_exhausted" };
      }

      step.status = input.status;
      if (input.status === "RUNNING") {
        step.attempts += 1;
        step.startedAt = step.startedAt ?? at.toISOString();
      }
      if (
        input.status === "SUCCEEDED" ||
        input.status === "FAILED" ||
        input.status === "SKIPPED" ||
        input.status === "CANCELLED"
      ) {
        step.completedAt = at.toISOString();
      }
      step.evidence = { ...step.evidence, ...(input.evidence ?? {}) };
      step.updatedAt = at.toISOString();

      const eventType: AgentEventType =
        input.status === "RUNNING"
          ? "step_started"
          : input.status === "SUCCEEDED"
            ? "step_succeeded"
            : input.status === "FAILED"
              ? "step_failed"
              : input.status === "SKIPPED"
                ? "step_skipped"
                : "step_cancelled";
      appendEvent(task.id, eventType, {
        step_id: step.id,
        seq: step.seq,
        status: input.status,
      });

      return { ok: true, status: input.status };
    },

    async reapExpired(at = now()) {
      let failed = 0;
      let cancelled = 0;

      for (const task of [...tasks.values()]) {
        if (
          !isTerminalState(task.state) &&
          Date.parse(task.deadlineAt) <= at.getTime()
        ) {
          task.state = "FAILED";
          task.failureReason = "deadline_exceeded";
          task.completedAt = at.toISOString();
          task.evidence = {
            ...task.evidence,
            reason: "deadline_exceeded",
            deadline_at: task.deadlineAt,
          };
          task.leaseToken = null;
          task.leaseExpiresAt = null;
          task.updatedAt = at.toISOString();
          appendEvent(task.id, "task_failed", {
            reason: "deadline_exceeded",
            deadline_at: task.deadlineAt,
          });
          failed += 1;
        }
      }

      for (const task of [...tasks.values()]) {
        if (
          !isTerminalState(task.state) &&
          task.cancelRequested &&
          !leaseIsActive(task, at)
        ) {
          task.state = "CANCELLED";
          task.completedAt = at.toISOString();
          task.evidence = { ...task.evidence, reason: "cancel_requested" };
          task.leaseToken = null;
          task.leaseExpiresAt = null;
          task.updatedAt = at.toISOString();
          appendEvent(task.id, "task_cancelled", {
            reason: "cancel_requested",
          });
          cancelled += 1;
        }
      }

      return { ok: true, failed, cancelled };
    },

    async getTask(taskId) {
      const task = tasks.get(taskId);
      return task ? cloneTask(task) : null;
    },

    async listSteps(taskId) {
      return stepsFor(taskId).map(cloneStep);
    },

    async listEvents(taskId, afterSeq, limit) {
      const bounded = Math.min(500, Math.max(1, Math.floor(limit)));
      return eventsFor(taskId)
        .filter((event) => event.seq > afterSeq)
        .slice(0, bounded)
        .map(cloneEvent);
    },

    snapshot() {
      return {
        tasks: [...tasks.values()].map(cloneTask),
        steps: [...steps.values()].map(cloneStep),
        events: [...events.values()].map(cloneEvent),
      };
    },
  };

  return store;
}
