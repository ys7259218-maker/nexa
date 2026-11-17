/**
 * B8 VERIFYING evidence checker tests (matrix VE-02 … VE-06).
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { ToolInvocationAudit } from "../tools/audit.ts";
import type { AgentEvent, AgentTask, AgentTaskStep } from "../types.ts";
import {
  checkVerifyEvidence,
  createVerifyEvidenceHook,
  type VerifyEvidenceInput,
} from "./evidenceChecks.ts";

const WORKSPACE = "ws-1";
const TASK_ID = "task-1";
const ZERO_HASH = "0".repeat(64);

function task(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: TASK_ID,
    sessionId: "session-1",
    workspaceId: WORKSPACE,
    goal: "g",
    state: "VERIFYING",
    planVersion: 1,
    cancelRequested: false,
    cancelRequestedAt: null,
    deadlineAt: "2026-11-17T10:00:00.000Z",
    maxSteps: 5,
    createdBy: "user-1",
    createdAt: "2026-11-17T09:00:00.000Z",
    updatedAt: "2026-11-17T09:01:00.000Z",
    lastHeartbeatAt: null,
    leaseToken: "lease-1",
    leaseExpiresAt: "2026-11-17T09:05:00.000Z",
    completedAt: null,
    failureReason: null,
    evidence: {},
    ...overrides,
  };
}

function step(overrides: Partial<AgentTaskStep> = {}): AgentTaskStep {
  return {
    id: "step-1",
    taskId: TASK_ID,
    workspaceId: WORKSPACE,
    seq: 1,
    kind: "mock",
    label: "act",
    toolName: "browser.act",
    toolVersion: "1.0.0",
    argsHash: ZERO_HASH,
    status: "SUCCEEDED",
    attempts: 1,
    idempotencyKey: "key-1",
    evidence: {},
    startedAt: "2026-11-17T09:00:10.000Z",
    completedAt: "2026-11-17T09:00:20.000Z",
    createdAt: "2026-11-17T09:00:00.000Z",
    updatedAt: "2026-11-17T09:00:20.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    id: "event-1",
    workspaceId: WORKSPACE,
    taskId: TASK_ID,
    seq: 1,
    type: "task_completed",
    payload: { from_state: "VERIFYING", to_state: "COMPLETE" },
    createdAt: "2026-11-17T09:00:30.000Z",
    ...overrides,
  };
}

function audit(
  overrides: Partial<ToolInvocationAudit> = {},
): ToolInvocationAudit {
  return {
    id: "audit-1",
    workspaceId: WORKSPACE,
    taskId: TASK_ID,
    stepId: "step-1",
    invocationKey: "key-1",
    toolName: "browser.act",
    toolVersion: "1.0.0",
    manifestHash: ZERO_HASH,
    timeoutClass: "standard",
    argsHash: ZERO_HASH,
    outputHash: ZERO_HASH,
    status: "SUCCEEDED",
    errorClass: null,
    attempt: 1,
    durationMs: 10,
    createdAt: "2026-11-17T09:00:20.000Z",
    completedAt: "2026-11-17T09:00:20.000Z",
    ...overrides,
  };
}

function input(overrides: Partial<VerifyEvidenceInput> = {}): VerifyEvidenceInput {
  return {
    task: task(),
    steps: [step()],
    events: [
      event({
        id: "event-step",
        seq: 1,
        type: "step_succeeded",
        payload: { step_id: "step-1", seq: 1, status: "SUCCEEDED" },
      }),
      event({ id: "event-done", seq: 2 }),
    ],
    audits: [audit()],
    openApprovals: [],
    ...overrides,
  };
}

test("VE-02 a missing terminal or step-succeeded event fails the check", () => {
  const noTerminal = checkVerifyEvidence(input({ events: [event({ type: "step_succeeded", payload: { step_id: "step-1" } })] }));
  assert.equal(noTerminal.ok, false);
  assert.ok(noTerminal.failures.includes("missing_terminal_event"));

  const noStepEvent = checkVerifyEvidence(input({ events: [event()] }));
  assert.equal(noStepEvent.ok, false);
  assert.ok(noStepEvent.failures.includes("missing_step_event"));
});

test("VE-03 a side-effecting step without an audit row fails", () => {
  const result = checkVerifyEvidence(input({ audits: [] }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ["missing_audit_row"]);
});

test("VE-04 complete event, step event and audit evidence allow COMPLETE", () => {
  const result = checkVerifyEvidence(input());

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.evidenceHash.length, 64);
});

test("VE-05 a throwing reader or checker fails closed and never allows COMPLETE", async () => {
  const throwingHook = createVerifyEvidenceHook(async () => {
    throw new Error("reader exploded");
  });
  const outcome = await throwingHook({ task: task(), store: {} as never });
  assert.deepEqual(outcome, { ok: false, reason: "evidence_check_error" });

  const invalid = checkVerifyEvidence({
    task: { id: "", workspaceId: "", state: "VERIFYING" },
    steps: null as never,
    events: [],
    audits: [],
    openApprovals: [],
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.failures, ["invalid_input"]);

  const passingHook = createVerifyEvidenceHook(async () => input());
  assert.deepEqual(
    await passingHook({ task: task(), store: {} as never }),
    { ok: true },
  );
});

test("VE-06 evidence from another workspace fails without a cross-workspace read", () => {
  const result = checkVerifyEvidence(
    input({ audits: [audit({ workspaceId: "ws-2" })] }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ["cross_workspace_evidence"]);
});

test("an open approval blocks COMPLETE", () => {
  const result = checkVerifyEvidence(
    input({
      openApprovals: [{ workspaceId: WORKSPACE, status: "pending" }],
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ["open_approval"]);
});
