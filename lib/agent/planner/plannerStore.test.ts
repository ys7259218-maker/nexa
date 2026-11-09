/**
 * Phase B B4 planner store tests.
 *
 * In-memory store with validation. Content-free hashes only — never raw
 * content or plaintext secrets.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryPlannerStore,
} from "./plannerStore.ts";
import type { PlanStatus, PlanStepStatus, PlannerStore } from "./plannerTypes.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore(): PlannerStore {
  return createInMemoryPlannerStore({ now: () => FIXED_NOW });
}

async function upsertPlan(
  store: PlannerStore,
  workspaceId: string,
  taskId: string,
  overrides: Partial<{
    status: PlanStatus;
    stepCap: number;
    stepsCompleted: number;
    contextHash: string;
  }> = {},
) {
  return store.upsertPlan({
    workspaceId,
    taskId,
    status: overrides.status ?? "draft",
    stepCap: overrides.stepCap ?? 5,
    stepsCompleted: overrides.stepsCompleted ?? null,
    contextHash: overrides.contextHash ?? "0000000000000000000000000000000000000000000000000000000000000000",
  });
}

test("upsertPlan creates a plan", async () => {
  const store = makeStore();
  const result = await upsertPlan(store, "ws-1", "task-1");
  assert.equal(result.ok, true);
  assert.equal(result.value.planId.length > 0, true);
});

test("upsertPlan is idempotent on (workspace, task)", async () => {
  const store = makeStore();
  const first = await upsertPlan(store, "ws-1", "task-1");
  assert.equal(first.ok, true);

  const second = await store.upsertPlan({
    workspaceId: "ws-1",
    taskId: "task-1",
    status: "executing",
    stepCap: 10,
    stepsCompleted: 3,
    contextHash: "1111111111111111111111111111111111111111111111111111111111111111",
  });
  assert.equal(second.ok, true);

  const plans = await store.listPlans("ws-1");
  assert.equal(plans.length, 1);
  assert.equal(plans[0].status, "executing");
  assert.equal(plans[0].stepCap, 10);
  assert.equal(plans[0].stepsCompleted, 3);
});

test("getPlan returns null when no plan exists", async () => {
  const store = makeStore();
  const plan = await store.getPlan("nonexistent");
  assert.equal(plan, null);
});

test("getPlan returns the active plan", async () => {
  const store = makeStore();
  await upsertPlan(store, "ws-1", "task-1");

  const plan = await store.getPlan((await store.listPlans("ws-1"))[0].id);
  assert.equal(plan?.workspaceId, "ws-1");
  assert.equal(plan?.taskId, "task-1");
  assert.equal(plan?.status, "draft");
});

test("listPlans returns only workspace-scoped plans", async () => {
  const store = makeStore();
  await upsertPlan(store, "ws-1", "task-1");
  await upsertPlan(store, "ws-2", "task-2");

  const ws1Plans = await store.listPlans("ws-1");
  assert.equal(ws1Plans.length, 1);
  assert.equal(ws1Plans[0].workspaceId, "ws-1");

  const ws2Plans = await store.listPlans("ws-2");
  assert.equal(ws2Plans.length, 1);
  assert.equal(ws2Plans[0].workspaceId, "ws-2");
});

test("cancelPlan cancels a plan", async () => {
  const store = makeStore();
  await upsertPlan(store, "ws-1", "task-1", { status: "executing" });

  const plan = await store.getPlan((await store.listPlans("ws-1"))[0].id);
  assert.equal(plan?.status, "executing");

  const cancelled = await store.cancelPlan({ workspaceId: "ws-1", planId: plan!.id });
  assert.equal(cancelled.ok, true);

  const updated = await store.getPlan(plan!.id);
  assert.equal(updated?.status, "cancelled");
  assert.equal(updated?.completedAt !== null, true);
});

test("cancelPlan returns plan_not_found when no plan exists", async () => {
  const store = makeStore();
  const cancelled = await store.cancelPlan({ workspaceId: "ws-1", planId: "nonexistent" });
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.reason, "plan_not_found");
});

test("validation rejects invalid status", async () => {
  const store = makeStore();
  const result = await store.upsertPlan({
    workspaceId: "ws-1",
    taskId: "task-1",
    status: "invalid_status" as PlanStatus,
    stepCap: 5,
    stepsCompleted: null,
    contextHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_status");
});

test("validation rejects invalid step cap", async () => {
  const store = makeStore();
  const result = await store.upsertPlan({
    workspaceId: "ws-1",
    taskId: "task-1",
    status: "draft",
    stepCap: 100,
    stepsCompleted: null,
    contextHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_step_cap");
});

test("validation rejects invalid context hash", async () => {
  const store = makeStore();
  const result = await store.upsertPlan({
    workspaceId: "ws-1",
    taskId: "task-1",
    status: "draft",
    stepCap: 5,
    stepsCompleted: null,
    contextHash: "not-a-hash",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_context_hash");
});

test("recordPlanStep creates a step", async () => {
  const store = makeStore();
  const planResult = await upsertPlan(store, "ws-1", "task-1");
  assert.equal(planResult.ok, true);

  const result = await store.recordPlanStep({
    workspaceId: "ws-1",
    planId: planResult.value.planId,
    seq: 1,
    toolName: "workspace.file.read",
    toolVersion: "1.0.0",
    toolFamily: "workspace.file.read",
    declaredTier: "T1",
    riskScore: null,
    status: "pending",
    attempts: 1,
    maxAttempts: 2,
    timeoutMs: 30000,
    inputsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    outputsHash: null,
    errorClass: null,
    startedAt: null,
    completedAt: null,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.stepId.length > 0, true);
});

test("listPlanSteps returns steps in seq order", async () => {
  const store = makeStore();
  const planResult = await upsertPlan(store, "ws-1", "task-1");
  assert.equal(planResult.ok, true);

  await store.recordPlanStep({
    workspaceId: "ws-1",
    planId: planResult.value.planId,
    seq: 2,
    toolName: "web.research.search",
    toolVersion: "1.0.0",
    toolFamily: "web.research.search",
    declaredTier: "T2",
    riskScore: null,
    status: "pending",
    attempts: 1,
    maxAttempts: 2,
    timeoutMs: 30000,
    inputsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    outputsHash: null,
    errorClass: null,
    startedAt: null,
    completedAt: null,
  });
  await store.recordPlanStep({
    workspaceId: "ws-1",
    planId: planResult.value.planId,
    seq: 1,
    toolName: "workspace.file.read",
    toolVersion: "1.0.0",
    toolFamily: "workspace.file.read",
    declaredTier: "T1",
    riskScore: null,
    status: "pending",
    attempts: 1,
    maxAttempts: 2,
    timeoutMs: 30000,
    inputsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    outputsHash: null,
    errorClass: null,
    startedAt: null,
    completedAt: null,
  });

  const steps = await store.listPlanSteps(planResult.value.planId);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].seq, 1);
  assert.equal(steps[1].seq, 2);
});

test("recordPlanCheckpoint creates a checkpoint", async () => {
  const store = makeStore();
  const planResult = await upsertPlan(store, "ws-1", "task-1");
  assert.equal(planResult.ok, true);

  const stepResult = await store.recordPlanStep({
    workspaceId: "ws-1",
    planId: planResult.value.planId,
    seq: 1,
    toolName: "workspace.file.read",
    toolVersion: "1.0.0",
    toolFamily: "workspace.file.read",
    declaredTier: "T1",
    riskScore: null,
    status: "pending",
    attempts: 1,
    maxAttempts: 2,
    timeoutMs: 30000,
    inputsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    outputsHash: null,
    errorClass: null,
    startedAt: null,
    completedAt: null,
  });
  assert.equal(stepResult.ok, true);

  const checkpointResult = await store.recordPlanCheckpoint({
    workspaceId: "ws-1",
    planStepId: stepResult.value.stepId,
    checkpointType: "pre_execution",
    decision: "ALLOW",
    decisionHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(checkpointResult.ok, true);

  const checkpoints = await store.listPlanCheckpoints(stepResult.value.stepId);
  assert.equal(checkpoints.length, 1);
  assert.equal(checkpoints[0].decision, "ALLOW");
});

test("validation rejects invalid step status", async () => {
  const store = makeStore();
  const planResult = await upsertPlan(store, "ws-1", "task-1");
  assert.equal(planResult.ok, true);

  const result = await store.recordPlanStep({
    workspaceId: "ws-1",
    planId: planResult.value.planId,
    seq: 1,
    toolName: "workspace.file.read",
    toolVersion: "1.0.0",
    toolFamily: "workspace.file.read",
    declaredTier: "T1",
    riskScore: null,
    status: "invalid_status" as PlanStepStatus,
    attempts: 1,
    maxAttempts: 2,
    timeoutMs: 30000,
    inputsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    outputsHash: null,
    errorClass: null,
    startedAt: null,
    completedAt: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_status");
});
