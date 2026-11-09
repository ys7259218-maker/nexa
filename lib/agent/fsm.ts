import {
  AGENT_DEFAULT_MAX_STEPS,
  AGENT_STEP_STATUSES,
  AGENT_TASK_STATES,
  AGENT_TERMINAL_STATES,
  type AgentPlanStep,
  type AgentStepStatus,
  type AgentTask,
  type AgentTaskState,
  type AgentTaskStep,
} from "./types.ts";

/**
 * Authoritative B1 task FSM. The SQL function `agent_task_transition_allowed`
 * contains the same pairs; a migration contract test keeps them in sync.
 */
export const AGENT_TASK_TRANSITIONS: Record<AgentTaskState, readonly AgentTaskState[]> = {
  INTAKE: ["CLARIFY", "PLANNING", "CANCELLED", "FAILED"],
  CLARIFY: ["PLANNING", "CANCELLED", "FAILED"],
  PLANNING: ["AWAITING_APPROVAL", "EXECUTING", "NEEDS_USER_INPUT", "CANCELLED", "FAILED"],
  AWAITING_APPROVAL: ["EXECUTING", "CANCELLED", "FAILED"],
  EXECUTING: ["VERIFYING", "AWAITING_APPROVAL", "NEEDS_USER_INPUT", "CANCELLED", "FAILED"],
  NEEDS_USER_INPUT: ["EXECUTING", "CANCELLED", "FAILED"],
  VERIFYING: ["COMPLETE", "AWAITING_APPROVAL", "NEEDS_USER_INPUT", "CANCELLED", "FAILED"],
  COMPLETE: [],
  FAILED: [],
  CANCELLED: [],
};

/** States the claim RPC may pick up. */
export const AGENT_RUNNABLE_STATES: readonly AgentTaskState[] = [
  "INTAKE",
  "CLARIFY",
  "PLANNING",
  "EXECUTING",
  "VERIFYING",
  "NEEDS_USER_INPUT",
];

/** States that require a human decision; the B1 runtime never guesses. */
export const AGENT_HUMAN_STATES: readonly AgentTaskState[] = [
  "CLARIFY",
  "AWAITING_APPROVAL",
  "NEEDS_USER_INPUT",
];

export function isAgentTaskState(value: unknown): value is AgentTaskState {
  return AGENT_TASK_STATES.includes(value as AgentTaskState);
}

export function isAgentStepStatus(value: unknown): value is AgentStepStatus {
  return AGENT_STEP_STATUSES.includes(value as AgentStepStatus);
}

export function isTerminalState(state: AgentTaskState): boolean {
  return AGENT_TERMINAL_STATES.includes(state as (typeof AGENT_TERMINAL_STATES)[number]);
}

export function isHumanState(state: AgentTaskState): boolean {
  return AGENT_HUMAN_STATES.includes(state);
}

export function canTransition(from: AgentTaskState, to: AgentTaskState): boolean {
  return AGENT_TASK_TRANSITIONS[from].includes(to);
}

export type AgentDeadlineEvidence = {
  reason: "deadline_exceeded";
  deadlineAt: string;
  state: AgentTaskState;
  stepsCompleted: number;
};

/**
 * Pure deadline gate. Invalid or past deadlines fail closed; terminal tasks
 * are never re-evaluated. No I/O, so it is safe in offline tests and workers.
 */
export function evaluateDeadline(
  task: Pick<AgentTask, "state" | "deadlineAt">,
  now: Date,
  stepsCompleted = 0,
): AgentDeadlineEvidence | null {
  if (isTerminalState(task.state)) return null;

  const deadline = Date.parse(task.deadlineAt);
  if (!Number.isFinite(deadline) || deadline <= now.getTime()) {
    return {
      reason: "deadline_exceeded",
      deadlineAt: task.deadlineAt,
      state: task.state,
      stepsCompleted,
    };
  }

  return null;
}

export type AgentStepSummary = {
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  skipped: number;
  cancelled: number;
  allTerminal: boolean;
};

export function summarizeSteps(steps: readonly AgentTaskStep[]): AgentStepSummary {
  const summary: AgentStepSummary = {
    total: steps.length,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    allTerminal: true,
  };

  for (const step of steps) {
    summary[step.status.toLowerCase() as "pending" | "running" | "succeeded" | "failed" | "skipped" | "cancelled"] += 1;
    if (step.status === "PENDING" || step.status === "RUNNING") {
      summary.allTerminal = false;
    }
  }

  return summary;
}

/** First non-terminal step in sequence order. A RUNNING step is resumed. */
export function selectNextStep(steps: readonly AgentTaskStep[]): AgentTaskStep | null {
  return (
    [...steps]
      .sort((left, right) => left.seq - right.seq)
      .find((step) => step.status === "PENDING" || step.status === "RUNNING") ?? null
  );
}

/**
 * Deterministic mock plan. B1 never calls a provider; the three labels are
 * fixed and the hash input is bounded. `maxSteps` is the task cap, not a
 * tunable-at-agent-will value.
 */
export function buildMockPlan(
  goal: string,
  maxSteps: number,
  hash: (value: string) => string,
): AgentPlanStep[] {
  const cap = Math.min(
    AGENT_DEFAULT_MAX_STEPS,
    Math.max(1, Number.isFinite(maxSteps) ? Math.floor(maxSteps) : AGENT_DEFAULT_MAX_STEPS),
  );
  const labels = ["Intake request", "Draft mock response", "Verify mock output"] as const;
  const selected = labels.slice(0, Math.min(labels.length, cap));

  return selected.map((label, index) => {
    const seq = index + 1;
    return {
      seq,
      label,
      toolName: "mock.echo",
      toolVersion: "1.0.0",
      argsHash: hash(JSON.stringify({ goal, seq, label, tool: "mock.echo", version: "1.0.0" })),
    };
  });
}
