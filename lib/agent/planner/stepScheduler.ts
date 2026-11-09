/**
 * Phase B B4 step DAG scheduler.
 *
 * Schedules plan steps in seq order with dependency awareness and
 * concurrent cap enforcement. Content-free: works with ids and statuses,
 * never raw content.
 */

import type { Plan, PlanStep } from "./plannerTypes.ts";

/**
 * Scheduler configuration.
 */
export type StepSchedulerConfig = Readonly<{
  workspaceTaskCap: number;
  globalTaskCap: number;
}>;

export const DEFAULT_STEP_SCHEDULER_CONFIG: StepSchedulerConfig = {
  workspaceTaskCap: 2,
  globalTaskCap: 20,
};

export type ScheduledStep = Readonly<{
  stepId: string;
  planId: string;
  seq: number;
  toolName: string;
  toolVersion: string;
  toolFamily: string;
  declaredTier: string;
  maxAttempts: number;
  timeoutMs: number;
  inputsHash: string;
}>;

export type ScheduleResult = Readonly<{
  nextStep: ScheduledStep | null;
  reason: "none" | "all_complete" | "blocked_by_pending" | "cap_reached";
  completedSteps: number;
  totalSteps: number;
}>;

/**
 * Schedule the next executable step from a plan's steps.
 *
 * Steps must run in seq order. A step is schedulable when all previous
 * steps are terminal (succeeded/failed/skipped/cancelled) and the current
 * step is pending. If the current step is not pending (e.g. already
 * running or terminal), the plan is blocked or complete.
 */
export function scheduleNextStep(
  plan: Plan,
  steps: PlanStep[],
  config: StepSchedulerConfig = DEFAULT_STEP_SCHEDULER_CONFIG,
): ScheduleResult {
  const terminalStatuses = new Set([
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
  ]);

  const sorted = [...steps].sort((left, right) => left.seq - right.seq);
  const totalSteps = sorted.length;

  if (totalSteps === 0) {
    return {
      nextStep: null,
      reason: "all_complete",
      completedSteps: 0,
      totalSteps: 0,
    };
  }

  // Find the first non-terminal step; all prior steps must be terminal.
  let firstNonTerminalIndex = -1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (!terminalStatuses.has(sorted[i].status)) {
      firstNonTerminalIndex = i;
      break;
    }
  }

  // All steps are terminal.
  if (firstNonTerminalIndex === -1) {
    return {
      nextStep: null,
      reason: "all_complete",
      completedSteps: totalSteps,
      totalSteps,
    };
  }

  // The first non-terminal step must be pending to be schedulable.
  // If it's running, the plan is blocked waiting on that step.
  const firstNonTerminal = sorted[firstNonTerminalIndex];
  if (firstNonTerminal.status !== "pending") {
    return {
      nextStep: null,
      reason: "blocked_by_pending",
      completedSteps: firstNonTerminalIndex,
      totalSteps,
    };
  }

  // All prior steps are terminal, and this step is pending → schedulable.
  const scheduled: ScheduledStep = {
    stepId: firstNonTerminal.id,
    planId: plan.id,
    seq: firstNonTerminal.seq,
    toolName: firstNonTerminal.toolName,
    toolVersion: firstNonTerminal.toolVersion,
    toolFamily: firstNonTerminal.toolFamily,
    declaredTier: firstNonTerminal.declaredTier,
    maxAttempts: firstNonTerminal.maxAttempts,
    timeoutMs: firstNonTerminal.timeoutMs,
    inputsHash: firstNonTerminal.inputsHash,
  };

  return {
    nextStep: scheduled,
    reason: "none",
    completedSteps: firstNonTerminalIndex,
    totalSteps,
  };
}
