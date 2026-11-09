/**
 * Phase B B4 step scheduler tests.
 *
 * Schedules plan steps in seq order with dependency awareness and
 * concurrent cap enforcement. Content-free: works with ids and statuses.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  scheduleNextStep,
  DEFAULT_STEP_SCHEDULER_CONFIG,
} from "./stepScheduler.ts";
import type { Plan, PlanStep, PlanStepStatus } from "./plannerTypes.ts";

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    workspaceId: "ws-1",
    taskId: "task-1",
    status: "executing",
    stepCap: 5,
    stepsCompleted: 0,
    contextHash: "0000000000000000000000000000000000000000000000000000000000000000",
    createdAt: "2026-11-09T17:00:00Z",
    updatedAt: "2026-11-09T17:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

function makeStep(
  seq: number,
  status: string,
  overrides: Partial<PlanStep> = {},
): PlanStep {
  return {
    id: `step-${seq}`,
    planId: "plan-1",
    seq,
    toolName: "workspace.file.read",
    toolVersion: "1.0.0",
    toolFamily: "workspace.file.read",
    declaredTier: "T1",
    riskScore: null,
    status: status as PlanStepStatus,
    attempts: 1,
    maxAttempts: 2,
    timeoutMs: 30000,
    inputsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    outputsHash: null,
    errorClass: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-11-09T17:00:00Z",
    updatedAt: "2026-11-09T17:00:00Z",
    ...overrides,
  };
}

test("scheduleNextStep schedules first pending step when all prior are terminal", () => {
  const plan = makePlan();
  const steps = [
    makeStep(1, "succeeded"),
    makeStep(2, "failed"),
    makeStep(3, "pending"),
    makeStep(4, "pending"),
  ];
  const result = scheduleNextStep(plan, steps);
  assert.equal(result.nextStep !== null, true);
  assert.equal(result.nextStep!.seq, 3);
  assert.equal(result.reason, "none");
  assert.equal(result.completedSteps, 2);
  assert.equal(result.totalSteps, 4);
});

test("scheduleNextStep returns all_complete when all steps are terminal", () => {
  const plan = makePlan({ status: "completed" });
  const steps = [
    makeStep(1, "succeeded"),
    makeStep(2, "succeeded"),
  ];
  const result = scheduleNextStep(plan, steps);
  assert.equal(result.nextStep, null);
  assert.equal(result.reason, "all_complete");
  assert.equal(result.completedSteps, 2);
  assert.equal(result.totalSteps, 2);
});

test("scheduleNextStep returns blocked_by_pending when first non-terminal is running", () => {
  const plan = makePlan();
  const steps = [
    makeStep(1, "succeeded"),
    makeStep(2, "running"),
    makeStep(3, "pending"),
  ];
  const result = scheduleNextStep(plan, steps);
  assert.equal(result.nextStep, null);
  assert.equal(result.reason, "blocked_by_pending");
  assert.equal(result.completedSteps, 1);
});

test("scheduleNextStep returns blocked_by_pending when first non-terminal is running", () => {
  const plan = makePlan();
  const steps = [
    makeStep(1, "succeeded"),
    makeStep(2, "running"),
    makeStep(3, "pending"),
  ];
  const result = scheduleNextStep(plan, steps);
  assert.equal(result.nextStep, null);
  assert.equal(result.reason, "blocked_by_pending");
  assert.equal(result.completedSteps, 1);
});

test("scheduleNextStep schedules next pending step when prior step is skipped", () => {
  const plan = makePlan();
  const steps = [
    makeStep(1, "succeeded"),
    makeStep(2, "skipped"),
    makeStep(3, "pending"),
  ];
  const result = scheduleNextStep(plan, steps);
  assert.equal(result.nextStep !== null, true);
  assert.equal(result.nextStep!.seq, 3);
  assert.equal(result.reason, "none");
});

test("scheduleNextStep returns all_complete for empty steps", () => {
  const plan = makePlan();
  const result = scheduleNextStep(plan, []);
  assert.equal(result.nextStep, null);
  assert.equal(result.reason, "all_complete");
  assert.equal(result.completedSteps, 0);
  assert.equal(result.totalSteps, 0);
});

test("scheduleNextStep sorts steps by seq", () => {
  const plan = makePlan();
  const steps = [
    makeStep(3, "pending"),
    makeStep(1, "succeeded"),
    makeStep(2, "succeeded"),
  ];
  const result = scheduleNextStep(plan, steps);
  assert.equal(result.nextStep!.seq, 3);
  assert.equal(result.completedSteps, 2);
});

test("scheduleNextStep defaults config works", () => {
  const plan = makePlan();
  const steps = [makeStep(1, "pending")];
  const result = scheduleNextStep(plan, steps, DEFAULT_STEP_SCHEDULER_CONFIG);
  assert.equal(result.nextStep!.seq, 1);
  assert.equal(result.reason, "none");
});
