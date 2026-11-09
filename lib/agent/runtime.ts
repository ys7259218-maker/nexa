import { createHash } from "node:crypto";

import {
  buildMockPlan,
  evaluateDeadline,
  isHumanState,
  isTerminalState,
  selectNextStep,
  summarizeSteps,
} from "./fsm.ts";
import { inspectAgentRuntimeGate, type AgentRuntimeEnvironment } from "./gate.ts";
import type { AgentTaskStore } from "./store.ts";
import {
  AGENT_DEFAULT_LEASE_SECONDS,
  AGENT_DEFAULT_MAX_STEPS,
  type AgentTask,
  type AgentTaskState,
  type AgentTaskStep,
} from "./types.ts";

export type AgentRuntimeResult =
  | { status: "disabled"; reason: "flag_off" | "production" }
  | {
      status: "idle";
      reason:
        | "no_task"
        | "awaiting_human"
        | "task_already_terminal"
        | "claim_error"
        | "invalid_worker"
        | "invalid_lease";
    }
  | { status: "completed"; taskId: string; stepsExecuted: number }
  | { status: "cancelled"; taskId: string; stepsExecuted: number }
  | { status: "failed"; taskId: string; reason: string; stepsExecuted: number }
  | { status: "lease_lost"; taskId: string; stepsExecuted: number };

export type AgentStepExecutor = (
  step: AgentTaskStep,
  task: AgentTask,
) => Promise<Record<string, unknown>>;

export type AgentRuntimeOptions = {
  workerId: string;
  leaseSeconds?: number;
  now?: () => Date;
  executeStep?: AgentStepExecutor;
  onBeforeStep?: (step: AgentTaskStep, task: AgentTask) => Promise<void> | void;
  onAfterStep?: (step: AgentTaskStep, task: AgentTask) => Promise<void> | void;
  stepTimeoutMs?: number;
  maxStepsPerRun?: number;
};

type ExecutionResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: "timeout" | "error" };

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Deterministic, side-effect-free B1 step. No network, filesystem, or model. */
export async function executeMockStep(
  step: AgentTaskStep,
  task: AgentTask,
): Promise<Record<string, unknown>> {
  return {
    mock: true,
    tool: step.toolName,
    tool_version: step.toolVersion,
    step_seq: step.seq,
    idempotency_key: step.idempotencyKey,
    goal_length: task.goal.length,
  };
}

function clampLeaseSeconds(value: number): number {
  if (!Number.isFinite(value)) return AGENT_DEFAULT_LEASE_SECONDS;
  return Math.min(300, Math.max(15, Math.floor(value)));
}

function clampTimeoutMs(value: number): number {
  if (!Number.isFinite(value)) return 5_000;
  return Math.min(60_000, Math.max(100, Math.floor(value)));
}

async function withTimeout(
  execution: Promise<Record<string, unknown>>,
  timeoutMs: number,
): Promise<ExecutionResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ExecutionResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: "timeout" }), timeoutMs);
  });

  try {
    return await Promise.race([
      execution
        .then((value) => ({ ok: true as const, value }))
        .catch(() => ({ ok: false as const, reason: "error" as const })),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isLeaseLoss(reason: string): boolean {
  return (
    reason === "lease_mismatch" ||
    reason === "lease_expired" ||
    reason === "not_found"
  );
}

/**
 * Claim and run at most one B1 task. The worker is stateless: every decision is
 * persisted before the next step, so a crash can only lose the in-flight mock
 * step, which is idempotency-keyed and requeued by the next claim.
 */
export async function runAgentTaskOnce(
  store: AgentTaskStore,
  environment: AgentRuntimeEnvironment,
  options: AgentRuntimeOptions,
): Promise<AgentRuntimeResult> {
  const gate = inspectAgentRuntimeGate(environment);
  if (!gate.enabled) {
    return {
      status: "disabled",
      reason: gate.reason === "production" ? "production" : "flag_off",
    };
  }

  const leaseSeconds = clampLeaseSeconds(
    options.leaseSeconds ?? AGENT_DEFAULT_LEASE_SECONDS,
  );
  const now = options.now ?? (() => new Date());
  const executeStep = options.executeStep ?? executeMockStep;
  const stepTimeoutMs = clampTimeoutMs(options.stepTimeoutMs ?? 5_000);
  const maxStepsPerRun = Math.max(1, Math.floor(options.maxStepsPerRun ?? 100));

  const claim = await store.claimTask(options.workerId, leaseSeconds);
  if (!claim.ok) {
    if (claim.reason === "none") return { status: "idle", reason: "no_task" };
    return { status: "idle", reason: claim.reason };
  }

  const { task, leaseToken } = claim;
  let released = false;
  let stepsExecuted = 0;

  const release = async () => {
    if (released) return;
    released = true;
    await store.release(task.id, leaseToken);
  };

  const transition = (
    from: AgentTaskState,
    to: AgentTaskState,
    reason?: string,
    evidence?: Record<string, unknown>,
  ) =>
    store.transition({
      taskId: task.id,
      leaseToken,
      from,
      to,
      reason,
      evidence,
    });

  const fail = async (
    from: AgentTaskState,
    reason: string,
    evidence: Record<string, unknown>,
  ): Promise<AgentRuntimeResult> => {
    await transition(from, "FAILED", reason, evidence);
    await release();
    return { status: "failed", taskId: task.id, reason, stepsExecuted };
  };

  const cancel = async (from: AgentTaskState): Promise<AgentRuntimeResult> => {
    await transition(from, "CANCELLED", "cancel_requested");
    await release();
    return { status: "cancelled", taskId: task.id, stepsExecuted };
  };

  try {
    if (isTerminalState(task.state)) {
      await release();
      return { status: "idle", reason: "task_already_terminal" };
    }

    if (isHumanState(task.state)) {
      await release();
      return { status: "idle", reason: "awaiting_human" };
    }

    const initialDeadline = evaluateDeadline(task, now(), 0);
    if (initialDeadline) {
      return await fail(task.state, "deadline_exceeded", initialDeadline);
    }

    let current = task;
    let steps = await store.listSteps(task.id);

    if (steps.length === 0) {
      if (current.state !== "INTAKE" && current.state !== "PLANNING") {
        return await fail(current.state, "missing_plan", {
          reason: "missing_plan",
          state: current.state,
        });
      }
      const plan = buildMockPlan(
        current.goal,
        current.maxSteps || AGENT_DEFAULT_MAX_STEPS,
        sha256Hex,
      );
      const planned = await store.planSteps(current.id, plan);
      if (!planned.ok) {
        return await fail(current.state, "plan_failed", {
          reason: "plan_failed",
        });
      }
      steps = planned.steps;
    }

    if (current.state === "INTAKE") {
      const planned = await transition("INTAKE", "PLANNING", "mock_plan_ready", {
        step_count: steps.length,
      });
      if (!planned.ok) {
        return await fail("INTAKE", "transition_failed", {
          reason: planned.reason,
        });
      }
      current = (await store.getTask(task.id)) ?? current;
    }

    if (current.state === "PLANNING") {
      const started = await transition(
        "PLANNING",
        "EXECUTING",
        "mock_plan_started",
        { step_count: steps.length },
      );
      if (!started.ok) {
        return await fail("PLANNING", "transition_failed", {
          reason: started.reason,
        });
      }
      current = (await store.getTask(task.id)) ?? current;
    }

    if (current.state === "VERIFYING") {
      const completed = await transition("VERIFYING", "COMPLETE", "mock_verified", {
        steps_completed: summarizeSteps(await store.listSteps(task.id)).succeeded,
      });
      if (!completed.ok) {
        return await fail("VERIFYING", "transition_failed", {
          reason: completed.reason,
        });
      }
      await release();
      return { status: "completed", taskId: task.id, stepsExecuted };
    }

    if (current.state !== "EXECUTING") {
      await release();
      return { status: "idle", reason: "awaiting_human" };
    }

    while (stepsExecuted < maxStepsPerRun) {
      current = (await store.getTask(task.id)) ?? current;

      if (isTerminalState(current.state)) {
        await release();
        if (current.state === "CANCELLED") {
          return { status: "cancelled", taskId: task.id, stepsExecuted };
        }
        if (current.state === "FAILED") {
          return {
            status: "failed",
            taskId: task.id,
            reason: current.failureReason ?? "failed",
            stepsExecuted,
          };
        }
        return { status: "completed", taskId: task.id, stepsExecuted };
      }

      if (current.cancelRequested) {
        return await cancel(current.state);
      }

      const deadline = evaluateDeadline(current, now(), stepsExecuted);
      if (deadline) {
        return await fail(current.state, "deadline_exceeded", deadline);
      }

      const heartbeat = await store.heartbeat(task.id, leaseToken, leaseSeconds);
      if (!heartbeat.ok) {
        if (isLeaseLoss(heartbeat.reason)) {
          released = true;
          return { status: "lease_lost", taskId: task.id, stepsExecuted };
        }
        return await fail(current.state, "heartbeat_failed", {
          reason: heartbeat.reason,
        });
      }
      if (heartbeat.cancelRequested) {
        return await cancel(current.state);
      }

      const allSteps = await store.listSteps(task.id);
      const next = selectNextStep(allSteps);
      if (!next) break;

      const running = await store.recordStep({
        taskId: task.id,
        leaseToken,
        stepId: next.id,
        status: "RUNNING",
      });
      if (!running.ok) {
        if (running.reason === "cancel_requested") {
          return await cancel(current.state);
        }
        if (isLeaseLoss(running.reason)) {
          released = true;
          return { status: "lease_lost", taskId: task.id, stepsExecuted };
        }
        return await fail(current.state, "step_record_failed", {
          reason: running.reason,
        });
      }

      if (options.onBeforeStep) {
        try {
          await options.onBeforeStep(next, current);
        } catch {
          await store.recordStep({
            taskId: task.id,
            leaseToken,
            stepId: next.id,
            status: "FAILED",
            evidence: { reason: "step_hook_failed" },
          });
          return await fail(current.state, "step_hook_failed", {
            reason: "step_hook_failed",
          });
        }
      }

      const afterHook = await store.getTask(task.id);
      if (afterHook?.cancelRequested) {
        await store.recordStep({
          taskId: task.id,
          leaseToken,
          stepId: next.id,
          status: "CANCELLED",
          evidence: { reason: "cancel_requested" },
        });
        return await cancel(current.state);
      }

      const execution = await withTimeout(
        executeStep(next, current),
        stepTimeoutMs,
      );
      if (!execution.ok) {
        const reason =
          execution.reason === "timeout" ? "step_timeout" : "step_execution_failed";
        await store.recordStep({
          taskId: task.id,
          leaseToken,
          stepId: next.id,
          status: "FAILED",
          evidence: { reason },
        });
        return await fail(current.state, reason, {
          reason,
          step_seq: next.seq,
        });
      }

      const recorded = await store.recordStep({
        taskId: task.id,
        leaseToken,
        stepId: next.id,
        status: "SUCCEEDED",
        evidence: execution.value,
      });
      if (!recorded.ok) {
        if (recorded.reason === "already_completed") {
          stepsExecuted += 1;
          continue;
        }
        if (recorded.reason === "cancel_requested") {
          return await cancel(current.state);
        }
        if (isLeaseLoss(recorded.reason)) {
          released = true;
          return { status: "lease_lost", taskId: task.id, stepsExecuted };
        }
        return await fail(current.state, "step_record_failed", {
          reason: recorded.reason,
        });
      }

      stepsExecuted += 1;

      if (options.onAfterStep) {
        try {
          await options.onAfterStep(next, current);
        } catch {
          // A test/observer hook must never corrupt persisted task state.
        }
      }
    }

    if (stepsExecuted >= maxStepsPerRun) {
      return await fail(current.state, "step_cap_exceeded", {
        reason: "step_cap_exceeded",
        steps_executed: stepsExecuted,
      });
    }

    const finalTask = (await store.getTask(task.id)) ?? current;
    if (finalTask.state === "EXECUTING") {
      const verifying = await transition(
        "EXECUTING",
        "VERIFYING",
        "mock_steps_complete",
        { steps_completed: stepsExecuted },
      );
      if (!verifying.ok) {
        return await fail("EXECUTING", "transition_failed", {
          reason: verifying.reason,
        });
      }
    }

    const verifyingTask = (await store.getTask(task.id)) ?? finalTask;
    if (verifyingTask.state === "VERIFYING") {
      const completed = await transition(
        "VERIFYING",
        "COMPLETE",
        "mock_verified",
        { steps_completed: stepsExecuted },
      );
      if (!completed.ok) {
        return await fail("VERIFYING", "transition_failed", {
          reason: completed.reason,
        });
      }
    }

    await release();
    return { status: "completed", taskId: task.id, stepsExecuted };
  } finally {
    await release();
  }
}
