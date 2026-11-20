/**
 * Phase B B9 controlled-console security tests (matrix B9-01 … B9-06).
 *
 * Offline and pure: no store, clock, network or database access. Proves that a
 * task's text, event payloads and evidence can never reach a rendered surface,
 * and that the existing runtime kill switch stays fail-closed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  projectB9ApprovalQueue,
  projectB9TaskDetail,
  toSafeB9Code,
} from "./b9Console.ts";
import { inspectAgentRuntimeGate } from "./gate.ts";
import type { AgentEvent, AgentTask, AgentTaskSummary } from "./types.ts";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TASK_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";

function fixtureTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: TASK_ID,
    sessionId: "session-1",
    workspaceId: WORKSPACE_ID,
    goal: "Call +919876543210 about the invoice and read out the customer note",
    state: "FAILED",
    planVersion: 1,
    cancelRequested: false,
    cancelRequestedAt: null,
    deadlineAt: "2026-11-18T10:00:00.000Z",
    maxSteps: 25,
    createdBy: "owner",
    createdAt: "2026-11-18T09:00:00.000Z",
    updatedAt: "2026-11-18T09:05:00.000Z",
    lastHeartbeatAt: null,
    leaseToken: null,
    leaseExpiresAt: null,
    completedAt: null,
    failureReason: "provider_timeout",
    evidence: { token: "secret-should-never-render", body: "private" },
    ...overrides,
  };
}

function fixtureEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    id: "event-1",
    workspaceId: WORKSPACE_ID,
    taskId: TASK_ID,
    seq: 1,
    type: "task_created",
    payload: { customer: "+919876543210", body: "private note" },
    createdAt: "2026-11-18T09:00:00.000Z",
    ...overrides,
  };
}

function fixtureSummary(overrides: Partial<AgentTaskSummary> = {}): AgentTaskSummary {
  const task = fixtureTask();
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    sessionId: task.sessionId,
    goal: task.goal,
    state: task.state,
    deadlineAt: task.deadlineAt,
    cancelRequested: task.cancelRequested,
    failureReason: task.failureReason,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    ...overrides,
  };
}

test("B9-01 safe codes are bounded and never echo arbitrary input", () => {
  assert.equal(toSafeB9Code("provider_timeout"), "provider_timeout");
  assert.equal(toSafeB9Code("  STEP_FAILED  "), "step_failed");
  assert.equal(toSafeB9Code("Call +91 98765 43210 about the invoice"), "other");
  assert.equal(toSafeB9Code('{"body":"private"}'), "other");
  assert.equal(toSafeB9Code("bad.code/with-slash"), "other");
  assert.equal(toSafeB9Code(null), null);
  assert.equal(toSafeB9Code(undefined), null);
  assert.equal(toSafeB9Code(""), null);
});

test("B9-02 task detail carries no goal, payload or evidence field", () => {
  const detail = projectB9TaskDetail(fixtureTask(), [fixtureEvent()]);
  assert.ok(detail);
  const serialized = JSON.stringify(detail);

  for (const forbidden of [
    "goal",
    "payload",
    "evidence",
    "9876543210",
    "private note",
    "secret-should-never-render",
    "invoice",
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `content-free detail must not contain ${forbidden}`,
    );
  }

  assert.equal(detail.id, TASK_ID);
  assert.equal(detail.state, "FAILED");
  assert.equal(detail.errorClass, "provider_timeout");
  assert.equal(detail.eventCount, 1);
  assert.deepEqual({ ...detail.eventTypes }, { task_created: 1 });
  assert.equal(Object.isFrozen(detail), true);
  assert.equal(projectB9TaskDetail(null, []), null);
});

test("B9-03 arbitrary event types collapse to a safe bucket", () => {
  const events = [
    fixtureEvent({ seq: 1, type: "task_created" }),
    fixtureEvent({ seq: 2, type: "step_succeeded" }),
    fixtureEvent({ seq: 3, type: "Step with +919876543210" as AgentEvent["type"] }),
  ];
  const detail = projectB9TaskDetail(fixtureTask({ failureReason: null }), events);

  assert.ok(detail);
  assert.deepEqual({ ...detail.eventTypes }, {
    task_created: 1,
    step_succeeded: 1,
    other: 1,
  });
  assert.equal(detail.errorClass, null);
  assert.equal(
    JSON.stringify(detail).includes("9876543210"),
    false,
    "a hostile event type must not leak a phone number",
  );
});

test("B9-04 approval queue is scoped, filtered and content-free", () => {
  const queue = projectB9ApprovalQueue([
    fixtureSummary({ id: OTHER_TASK_ID, state: "AWAITING_APPROVAL" }),
    fixtureSummary({ id: TASK_ID, state: "COMPLETE" }),
    fixtureSummary({
      id: TASK_ID,
      state: "AWAITING_APPROVAL",
      failureReason: "Call +91 98765 43210",
    }),
  ]);

  assert.equal(queue.total, 2);
  assert.deepEqual(
    queue.rows.map((row) => row.id),
    [OTHER_TASK_ID, TASK_ID],
  );
  assert.equal(JSON.stringify(queue).includes("9876543210"), false);
  assert.equal(JSON.stringify(queue).includes("goal"), false);
  for (const row of queue.rows) {
    assert.deepEqual(Object.keys(row).sort(), [
      "createdAt",
      "deadlineAt",
      "id",
      "state",
    ]);
  }
});

test("B9-05 runtime gate stays fail-closed for off and production", () => {
  assert.deepEqual(inspectAgentRuntimeGate({}), {
    enabled: false,
    reason: "flag_off",
  });
  assert.deepEqual(inspectAgentRuntimeGate({ AGENT_RUNTIME_ENABLED: "TRUE" }), {
    enabled: false,
    reason: "flag_off",
  });
  assert.deepEqual(
    inspectAgentRuntimeGate({
      AGENT_RUNTIME_ENABLED: "true",
      VERCEL_ENV: "production",
    }),
    { enabled: false, reason: "production" },
  );
  assert.deepEqual(
    inspectAgentRuntimeGate({
      AGENT_RUNTIME_ENABLED: "true",
      NODE_ENV: "production",
    }),
    { enabled: false, reason: "production" },
  );
  assert.deepEqual(
    inspectAgentRuntimeGate({ AGENT_RUNTIME_ENABLED: "true" }),
    { enabled: true, reason: "enabled" },
  );
});

test("B9-06 a content-bearing failure reason cannot survive projection", () => {
  const detail = projectB9TaskDetail(
    fixtureTask({
      failureReason: "Sent a message to +919876543210 with the private body",
    }),
    [fixtureEvent()],
  );

  assert.ok(detail);
  assert.equal(detail.errorClass, "other");
  assert.equal(JSON.stringify(detail).includes("919876543210"), false);
  assert.equal(JSON.stringify(detail).includes("private body"), false);
});
