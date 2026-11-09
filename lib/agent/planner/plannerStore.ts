/**
 * Phase B B4 planning & orchestration store contracts.
 *
 * Deterministic in-memory store with validation. A Supabase implementation
 * maps every write to the reviewed SECURITY DEFINER RPCs from migration
 * `20261109030000_planning_orchestration_b4.sql`. Content-free hashes
 * only — never raw content or plaintext secrets.
 */

import { randomUUID } from "node:crypto";

import {
  HASH_PATTERN,
  MAX_ATTEMPTS_MAX,
  MAX_ATTEMPTS_MIN,
  PLAN_CHECKPOINT_DECISIONS,
  PLAN_CHECKPOINT_TYPES,
  PLAN_STATUSES,
  PLAN_STEP_CAP_MAX,
  PLAN_STEP_CAP_MIN,
  PLAN_STEP_STATUSES,
  TIMEOUT_MS_MAX,
  TIMEOUT_MS_MIN,
  type CancelPlanInput,
  type Plan,
  type PlanCheckpoint,
  type PlanCheckpointDecision,
  type PlanCheckpointType,
  type PlanGate,
  type PlanStatus,
  type PlanStep,
  type PlanStepStatus,
  type PlannerStore,
  type RecordPlanCheckpointInput,
  type RecordPlanStepInput,
  type StoreOutcome,
  type UpsertPlanInput,
  type UpdatePlanProgressInput,
  isPlanCheckpointDecision,
  isPlanCheckpointType,
  isPlanStatus,
  isPlanStepStatus,
  isSha256Hex,
} from "./plannerTypes.ts";

const TOOL_NAME_PATTERN =
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$/;
const TOOL_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const NON_EMPTY_ID_PATTERN = /^[-A-Za-z0-9:_.]{1,200}$/;

function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && NON_EMPTY_ID_PATTERN.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function validatePlanInput(input: UpsertPlanInput): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isNonEmptyId(input.taskId)) return "invalid_task";
  if (!isPlanStatus(input.status)) return "invalid_status";
  if (
    !Number.isInteger(input.stepCap) ||
    input.stepCap < PLAN_STEP_CAP_MIN ||
    input.stepCap > PLAN_STEP_CAP_MAX
  ) {
    return "invalid_step_cap";
  }
  if (
    input.stepsCompleted !== null &&
    (!Number.isInteger(input.stepsCompleted) ||
      input.stepsCompleted < 0 ||
      input.stepsCompleted > input.stepCap)
  ) {
    return "invalid_steps_completed";
  }
  if (!isSha256Hex(input.contextHash)) return "invalid_context_hash";
  return null;
}

function validatePlanProgressInput(
  input: UpdatePlanProgressInput,
): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isNonEmptyId(input.planId)) return "invalid_plan";
  if (
    !Number.isInteger(input.stepsCompleted) ||
    input.stepsCompleted < 0
  ) {
    return "invalid_steps_completed";
  }
  return null;
}

function validateCancelInput(input: CancelPlanInput): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isNonEmptyId(input.planId)) return "invalid_plan";
  return null;
}

function validatePlanStepInput(input: RecordPlanStepInput): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isNonEmptyId(input.planId)) return "invalid_plan";
  if (!Number.isInteger(input.seq) || input.seq < 1) return "invalid_seq";
  if (!TOOL_NAME_PATTERN.test(input.toolName)) return "invalid_tool_name";
  if (!TOOL_VERSION_PATTERN.test(input.toolVersion))
    return "invalid_tool_version";
  if (!TOOL_NAME_PATTERN.test(input.toolFamily)) return "invalid_tool_family";
  if (
    input.declaredTier !== "T0" &&
    input.declaredTier !== "T1" &&
    input.declaredTier !== "T2" &&
    input.declaredTier !== "T3" &&
    input.declaredTier !== "T4" &&
    input.declaredTier !== "T5"
  ) {
    return "invalid_declared_tier";
  }
  if (!isPlanStepStatus(input.status)) return "invalid_status";
  if (
    !Number.isInteger(input.attempts) ||
    input.attempts < 1 ||
    input.attempts > input.maxAttempts
  ) {
    return "invalid_attempts";
  }
  if (
    !Number.isInteger(input.maxAttempts) ||
    input.maxAttempts < MAX_ATTEMPTS_MIN ||
    input.maxAttempts > MAX_ATTEMPTS_MAX
  ) {
    return "invalid_max_attempts";
  }
  if (
    !Number.isInteger(input.timeoutMs) ||
    input.timeoutMs < TIMEOUT_MS_MIN ||
    input.timeoutMs > TIMEOUT_MS_MAX
  ) {
    return "invalid_timeout_ms";
  }
  if (!isSha256Hex(input.inputsHash)) return "invalid_inputs_hash";
  if (
    input.outputsHash !== null && !isSha256Hex(input.outputsHash)
  ) {
    return "invalid_outputs_hash";
  }
  if (
    input.errorClass !== null &&
    !["VALIDATION", "PERMISSION", "RATE_LIMIT", "TIMEOUT", "UPSTREAM", "INTERNAL"].includes(
      input.errorClass,
    )
  ) {
    return "invalid_error_class";
  }
  if (input.startedAt !== null && !isIsoTimestamp(input.startedAt)) {
    return "invalid_started_at";
  }
  if (input.completedAt !== null && !isIsoTimestamp(input.completedAt)) {
    return "invalid_completed_at";
  }
  return null;
}

function validatePlanCheckpointInput(
  input: RecordPlanCheckpointInput,
): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isNonEmptyId(input.planStepId)) return "invalid_plan_step";
  if (!isPlanCheckpointType(input.checkpointType)) return "invalid_checkpoint_type";
  if (!isPlanCheckpointDecision(input.decision)) return "invalid_decision";
  if (!isSha256Hex(input.decisionHash)) return "invalid_decision_hash";
  return null;
}

function clonePlan(row: Plan): Plan {
  return { ...row };
}

function clonePlanStep(row: PlanStep): PlanStep {
  return { ...row };
}

function clonePlanCheckpoint(row: PlanCheckpoint): PlanCheckpoint {
  return { ...row };
}

export function createInMemoryPlannerStore(
  options: {
    now?: () => Date;
    idFactory?: () => string;
  } = {},
): PlannerStore {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => randomUUID());

  const plans = new Map<string, Plan>();
  const plansByWorkspaceTask = new Map<string, string>(); // workspaceId:taskId -> planId
  const planSteps = new Map<string, PlanStep>();
  const stepsByPlan = new Map<string, string[]>(); // planId -> stepIds
  const checkpoints = new Map<string, PlanCheckpoint>();
  const checkpointsByStep = new Map<string, string[]>(); // planStepId -> checkpointIds

  return {
    async upsertPlan(input: UpsertPlanInput): Promise<StoreOutcome<{ planId: string }>> {
      const invalid = validatePlanInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const key = `${input.workspaceId}:${input.taskId}`;
      const existing = plans.get(plansByWorkspaceTask.get(key) ?? "");

      const stepsCompleted =
        input.stepsCompleted ?? existing?.stepsCompleted ?? 0;

      const plan: Plan = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        status: input.status,
        stepCap: input.stepCap,
        stepsCompleted,
        contextHash: input.contextHash,
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
        completedAt:
          existing?.completedAt ??
          (input.status === "completed" ||
            input.status === "failed" ||
            input.status === "cancelled"
            ? now().toISOString()
            : null),
      };

      plans.set(plan.id, plan);
      plansByWorkspaceTask.set(key, plan.id);
      return { ok: true, value: { planId: plan.id } };
    },

    async updatePlanProgress(
      input: UpdatePlanProgressInput,
    ): Promise<StoreOutcome<{ planId: string }>> {
      const invalid = validatePlanProgressInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const plan = plans.get(input.planId);
      if (!plan) return { ok: false, reason: "plan_not_found" };
      if (plan.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "workspace_mismatch" };
      }

      const updated: Plan = {
        ...plan,
        stepsCompleted: input.stepsCompleted,
        updatedAt: now().toISOString(),
      };
      plans.set(plan.id, updated);
      return { ok: true, value: { planId: plan.id } };
    },

    async cancelPlan(
      input: CancelPlanInput,
    ): Promise<StoreOutcome<{ planId: string }>> {
      const invalid = validateCancelInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const plan = plans.get(input.planId);
      if (!plan) return { ok: false, reason: "plan_not_found" };
      if (plan.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "workspace_mismatch" };
      }
      if (
        plan.status === "completed" ||
        plan.status === "failed" ||
        plan.status === "cancelled"
      ) {
        return { ok: true, value: { planId: plan.id } };
      }

      const updated: Plan = {
        ...plan,
        status: "cancelled",
        updatedAt: now().toISOString(),
        completedAt: now().toISOString(),
      };
      plans.set(plan.id, updated);
      return { ok: true, value: { planId: plan.id } };
    },

    async listPlans(workspaceId: string): Promise<Plan[]> {
      return [...plans.values()]
        .filter((p) => p.workspaceId === workspaceId)
        .map(clonePlan);
    },

    async getPlan(planId: string): Promise<Plan | null> {
      const plan = plans.get(planId);
      return plan ? clonePlan(plan) : null;
    },

    async recordPlanStep(
      input: RecordPlanStepInput,
    ): Promise<StoreOutcome<{ stepId: string }>> {
      const invalid = validatePlanStepInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const plan = plans.get(input.planId);
      if (!plan) return { ok: false, reason: "plan_not_found" };
      if (plan.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "workspace_mismatch" };
      }

      const key = `${input.planId}:${input.seq}`;
      const existingStepId = stepsByPlan.get(input.planId)?.find((sid) => {
        const s = planSteps.get(sid);
        return s && s.seq === input.seq ? sid : null;
      });
      const existing = existingStepId ? planSteps.get(existingStepId) : undefined;

      const step: PlanStep = {
        id: existing?.id ?? idFactory(),
        planId: input.planId,
        seq: input.seq,
        toolName: input.toolName,
        toolVersion: input.toolVersion,
        toolFamily: input.toolFamily,
        declaredTier: input.declaredTier,
        riskScore: input.riskScore,
        status: input.status,
        attempts: input.attempts,
        maxAttempts: input.maxAttempts,
        timeoutMs: input.timeoutMs,
        inputsHash: input.inputsHash,
        outputsHash: input.outputsHash,
        errorClass: input.errorClass,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
      };

      planSteps.set(step.id, step);
      const planStepIds = stepsByPlan.get(input.planId) ?? [];
      if (!planStepIds.includes(step.id)) {
        planStepIds.push(step.id);
        stepsByPlan.set(input.planId, planStepIds);
      }
      return { ok: true, value: { stepId: step.id } };
    },

    async listPlanSteps(planId: string): Promise<PlanStep[]> {
      const stepIds = stepsByPlan.get(planId) ?? [];
      return stepIds
        .map((sid) => planSteps.get(sid))
        .filter((s): s is PlanStep => s !== null)
        .sort((left, right) => left.seq - right.seq)
        .map(clonePlanStep);
    },

    async getPlanStep(stepId: string): Promise<PlanStep | null> {
      const step = planSteps.get(stepId);
      return step ? clonePlanStep(step) : null;
    },

    async recordPlanCheckpoint(
      input: RecordPlanCheckpointInput,
    ): Promise<StoreOutcome<{ checkpointId: string }>> {
      const invalid = validatePlanCheckpointInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const step = planSteps.get(input.planStepId);
      if (!step) return { ok: false, reason: "plan_step_not_found" };

      const plan = plans.get(step.planId);
      if (!plan || plan.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "workspace_mismatch" };
      }

      const checkpoint: PlanCheckpoint = {
        id: idFactory(),
        planStepId: input.planStepId,
        checkpointType: input.checkpointType,
        decision: input.decision,
        decisionHash: input.decisionHash,
        checkedAt: now().toISOString(),
        checkedBy: null,
      };

      checkpoints.set(checkpoint.id, checkpoint);
      const stepCheckpoints = checkpointsByStep.get(input.planStepId) ?? [];
      stepCheckpoints.push(checkpoint.id);
      checkpointsByStep.set(input.planStepId, stepCheckpoints);

      return { ok: true, value: { checkpointId: checkpoint.id } };
    },

    async listPlanCheckpoints(planStepId: string): Promise<PlanCheckpoint[]> {
      const checkpointIds = checkpointsByStep.get(planStepId) ?? [];
      return checkpointIds
        .map((cid) => checkpoints.get(cid))
        .filter((c): c is PlanCheckpoint => c !== null)
        .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt))
        .map(clonePlanCheckpoint);
    },
  };
}
