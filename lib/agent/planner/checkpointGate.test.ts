/**
 * Phase B B4 checkpoint gate tests.
 *
 * Pre-execution checkpoint for every plan step: calls B3 authorize()
 * before a step can execute. Content-free: only ids and hashes.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { runPreExecutionCheckpoint } from "./checkpointGate.ts";
import type { PlanStep, PlannerOptions } from "./plannerTypes.ts";

function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: "step-1",
    planId: "plan-1",
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
    createdAt: "2026-11-09T17:00:00Z",
    updatedAt: "2026-11-09T17:00:00Z",
    ...overrides,
  };
}

function makeOptions(
  authorizeResult: {
    decision: "ALLOW" | "CHALLENGE" | "DENY";
    effectiveTier: string;
    requiresApproval: boolean;
    ttlSeconds: number | null;
  },
): PlannerOptions {
  let checkpointRecorded: {
    planStepId: string;
    checkpointType: string;
    decision: string;
    decisionHash: string;
  } | null = null;
  return {
    store: {} as never,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    authorizeStep: async () => authorizeResult,
    recordCheckpoint: async (
      planStepId: string,
      checkpointType: string,
      decision: string,
      decisionHash: string,
    ) => {
      checkpointRecorded = { planStepId, checkpointType, decision, decisionHash };
    },
    now: () => new Date("2026-11-09T17:00:00Z"),
  } as unknown as PlannerOptions;
}

test("checkpoint returns ALLOW when authorize returns ALLOW", async () => {
  const step = makeStep();
  const options = makeOptions({
    decision: "ALLOW",
    effectiveTier: "T1",
    requiresApproval: false,
    ttlSeconds: null,
  });
  const result = await runPreExecutionCheckpoint(step, options);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.permitted, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.effectiveTier, "T1");
});

test("checkpoint returns CHALLENGE when authorize returns CHALLENGE", async () => {
  const step = makeStep();
  const options = makeOptions({
    decision: "CHALLENGE",
    effectiveTier: "T2",
    requiresApproval: true,
    ttlSeconds: null,
  });
  const result = await runPreExecutionCheckpoint(step, options);
  assert.equal(result.decision, "CHALLENGE");
  assert.equal(result.permitted, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.effectiveTier, "T2");
});

test("checkpoint returns DENY when authorize returns DENY", async () => {
  const step = makeStep();
  const options = makeOptions({
    decision: "DENY",
    effectiveTier: "T5",
    requiresApproval: true,
    ttlSeconds: null,
  });
  const result = await runPreExecutionCheckpoint(step, options);
  assert.equal(result.decision, "DENY");
  assert.equal(result.permitted, false);
  assert.equal(result.effectiveTier, "T5");
});

test("checkpoint records content-free decision hash", async () => {
  const step = makeStep();
  let captured: {
    planStepId: string;
    checkpointType: string;
    decision: string;
    decisionHash: string;
  } | null = null;
  const options = {
    store: {} as never,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    authorizeStep: async () => ({
      decision: "ALLOW",
      effectiveTier: "T1",
      requiresApproval: false,
      ttlSeconds: null,
    }),
    recordCheckpoint: async (
      planStepId: string,
      checkpointType: string,
      decision: string,
      decisionHash: string,
    ) => {
      captured = { planStepId, checkpointType, decision, decisionHash };
    },
    now: () => new Date("2026-11-09T17:00:00Z"),
  } as unknown as PlannerOptions;
  const result = await runPreExecutionCheckpoint(step, options);
  assert.equal(captured!.planStepId, step.id);
  assert.equal(captured!.checkpointType, "pre_execution");
  assert.equal(captured!.decision, "ALLOW");
  assert.equal(captured!.decisionHash.length === 64, true);
  assert.equal(result.decisionHash.length === 64, true);
});

test("checkpoint does not include raw content in hash", async () => {
  const step = makeStep({ inputsHash: "sk_live_secret_12345" });
  let captured: string | null = null;
  const options = {
    store: {} as never,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    authorizeStep: async () => ({
      decision: "ALLOW",
      effectiveTier: "T1",
      requiresApproval: false,
      ttlSeconds: null,
    }),
    recordCheckpoint: async (_planStepId: string, _checkpointType: string, _decision: string, decisionHash: string) => {
      captured = decisionHash;
    },
    now: () => new Date("2026-11-09T17:00:00Z"),
  } as unknown as PlannerOptions;
  const result = await runPreExecutionCheckpoint(step, options);
  assert.equal(captured !== step.inputsHash, true);
  assert.equal(result.decisionHash.length === 64, true);
});
