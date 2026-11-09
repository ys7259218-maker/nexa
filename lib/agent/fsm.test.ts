import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_HUMAN_STATES,
  AGENT_RUNNABLE_STATES,
  AGENT_TASK_TRANSITIONS,
  buildMockPlan,
  canTransition,
  evaluateDeadline,
  isAgentStepStatus,
  isAgentTaskState,
  isHumanState,
  isTerminalState,
  selectNextStep,
  summarizeSteps,
} from "./fsm.ts";
import {
  AGENT_TERMINAL_STATES,
  AGENT_TASK_STATES,
  type AgentStepStatus,
  type AgentTaskStep,
} from "./types.ts";

function makeStep(seq: number, status: AgentStepStatus): AgentTaskStep {
  return {
    id: `step-${seq}`,
    taskId: "task-1",
    workspaceId: "workspace-1",
    seq,
    kind: "mock",
    label: `Step ${seq}`,
    toolName: "mock.echo",
    toolVersion: "1.0.0",
    argsHash: "a".repeat(64),
    status,
    attempts: status === "PENDING" ? 0 : 1,
    idempotencyKey: `task-1:${seq}`,
    evidence: {},
    startedAt: null,
    completedAt: null,
    createdAt: "2026-11-08T00:00:00.000Z",
    updatedAt: "2026-11-08T00:00:00.000Z",
  };
}

test("every task state has a transition row and terminal states are locked", () => {
  for (const state of AGENT_TASK_STATES) {
    assert.ok(Array.isArray(AGENT_TASK_TRANSITIONS[state]), `missing row for ${state}`);
  }

  for (const terminal of AGENT_TERMINAL_STATES) {
    assert.deepEqual(AGENT_TASK_TRANSITIONS[terminal], [], `${terminal} must have no outgoing transition`);
  }

  assert.equal(canTransition("INTAKE", "PLANNING"), true);
  assert.equal(canTransition("PLANNING", "EXECUTING"), true);
  assert.equal(canTransition("EXECUTING", "VERIFYING"), true);
  assert.equal(canTransition("VERIFYING", "COMPLETE"), true);
  assert.equal(canTransition("INTAKE", "EXECUTING"), false);
  assert.equal(canTransition("COMPLETE", "FAILED"), false);
  assert.equal(canTransition("FAILED", "EXECUTING"), false);
  assert.equal(canTransition("CANCELLED", "COMPLETE"), false);
});

test("state, status, and human-decision guards accept only reviewed values", () => {
  assert.equal(isAgentTaskState("EXECUTING"), true);
  assert.equal(isAgentTaskState("executing"), false);
  assert.equal(isAgentTaskState(null), false);
  assert.equal(isAgentTaskState(42), false);

  assert.equal(isAgentStepStatus("RUNNING"), true);
  assert.equal(isAgentStepStatus("running"), false);
  assert.equal(isAgentStepStatus(undefined), false);

  assert.equal(isTerminalState("COMPLETE"), true);
  assert.equal(isTerminalState("FAILED"), true);
  assert.equal(isTerminalState("CANCELLED"), true);
  assert.equal(isTerminalState("EXECUTING"), false);

  assert.equal(isHumanState("CLARIFY"), true);
  assert.equal(isHumanState("AWAITING_APPROVAL"), true);
  assert.equal(isHumanState("NEEDS_USER_INPUT"), true);
  assert.equal(isHumanState("EXECUTING"), false);

  assert.deepEqual(
    [...AGENT_HUMAN_STATES],
    ["CLARIFY", "AWAITING_APPROVAL", "NEEDS_USER_INPUT"],
  );
  assert.ok(!AGENT_RUNNABLE_STATES.includes("AWAITING_APPROVAL"));
  assert.ok(!AGENT_RUNNABLE_STATES.includes("COMPLETE"));
});

test("deadline evaluation fails closed for past, invalid, and terminal states", () => {
  const now = new Date("2026-11-08T00:00:00.000Z");
  const future = "2026-11-08T00:10:00.000Z";
  const past = "2026-11-07T23:59:59.000Z";

  assert.equal(evaluateDeadline({ state: "EXECUTING", deadlineAt: future }, now), null);

  assert.deepEqual(evaluateDeadline({ state: "EXECUTING", deadlineAt: past }, now, 2), {
    reason: "deadline_exceeded",
    deadlineAt: past,
    state: "EXECUTING",
    stepsCompleted: 2,
  });

  assert.equal(
    evaluateDeadline({ state: "EXECUTING", deadlineAt: "not-a-date" }, now)?.reason,
    "deadline_exceeded",
  );

  assert.equal(
    evaluateDeadline({ state: "EXECUTING", deadlineAt: now.toISOString() }, now)?.reason,
    "deadline_exceeded",
  );

  assert.equal(evaluateDeadline({ state: "COMPLETE", deadlineAt: past }, now), null);
  assert.equal(evaluateDeadline({ state: "FAILED", deadlineAt: past }, now), null);
  assert.equal(evaluateDeadline({ state: "CANCELLED", deadlineAt: past }, now), null);
});

test("step summaries and next-step selection respect sequence and terminal status", () => {
  const steps = [
    makeStep(2, "SUCCEEDED"),
    makeStep(1, "PENDING"),
    makeStep(3, "RUNNING"),
    makeStep(4, "FAILED"),
  ];

  const summary = summarizeSteps(steps);
  assert.equal(summary.total, 4);
  assert.equal(summary.pending, 1);
  assert.equal(summary.running, 1);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.skipped, 0);
  assert.equal(summary.cancelled, 0);
  assert.equal(summary.allTerminal, false);

  assert.equal(selectNextStep(steps)?.seq, 1);
  assert.equal(selectNextStep([makeStep(1, "SUCCEEDED"), makeStep(2, "RUNNING")])?.seq, 2);
  assert.equal(selectNextStep([makeStep(1, "SUCCEEDED")]), null);

  const done = summarizeSteps([makeStep(1, "SUCCEEDED"), makeStep(2, "SKIPPED")]);
  assert.equal(done.allTerminal, true);
  assert.equal(done.skipped, 1);
});

test("mock plan is deterministic, bounded, and mock-only", () => {
  const hash = (value: string) => `hash:${value.length}`;
  const plan = buildMockPlan("Answer the customer", 25, hash);

  assert.equal(plan.length, 3);
  assert.deepEqual(
    plan.map((step) => step.seq),
    [1, 2, 3],
  );
  assert.ok(plan.every((step) => step.toolName === "mock.echo"));
  assert.ok(plan.every((step) => step.toolVersion === "1.0.0"));
  assert.ok(plan.every((step) => step.argsHash.startsWith("hash:")));

  const again = buildMockPlan("Answer the customer", 25, hash);
  assert.deepEqual(again, plan);

  assert.equal(buildMockPlan("goal", 2, hash).length, 2);
  assert.equal(buildMockPlan("goal", 0, hash).length, 1);
  assert.equal(buildMockPlan("goal", Number.NaN, hash).length, 3);

  const distinct = buildMockPlan("A different goal", 25, (value) => `hash:${value.length}`);
  assert.notDeepEqual(distinct, plan);
});
