/**
 * Phase B B8 scripted scenario packs (matrix SC-01 … SC-06).
 *
 * Every scenario is offline and deterministic: in-memory stores, the mock
 * browser driver, an injected clock and no provider, network, hosted database
 * or real browser. Replaying a milestone here never replaces its own test
 * file; it proves the merged contracts still compose end to end.
 */

import { createApprovalGate } from "../browser/approvalGate.ts";
import { createBrowserService } from "../browser/browserService.ts";
import { createInMemoryEvidenceStore } from "../browser/evidence.ts";
import { createMockDriver } from "../browser/mockDriver.ts";
import { createSessionPolicy } from "../browser/sessionPolicy.ts";
import { inspectMemoryGate } from "../memory/memoryGate.ts";
import { runPreExecutionCheckpoint } from "../planner/checkpointGate.ts";
import type { PlanStep, PlannerOptions } from "../planner/plannerTypes.ts";
import { runAgentTaskOnce } from "../runtime.ts";
import {
  createInMemoryAgentStore,
  type AgentTaskStore,
  type CreateTaskOutcome,
} from "../store.ts";
import { authorize } from "../tools/permissionEngine.ts";
import type { PermissionEngineOptions } from "../tools/permissionEngine.ts";
import { createInMemoryPermissionStore } from "../tools/permissionStore.ts";
import type { ToolCall } from "../tools/permissionTypes.ts";
import type { AgentEvalContext, AgentEvalSuite } from "./types.ts";

const WORKSPACE = "00000000-0000-4000-8000-0000000000b8";
const USER = "00000000-0000-4000-8000-0000000000b1";
const WORKER = "worker-eval";
const ZERO_HASH = "0".repeat(64);

const RUNTIME_ON = { AGENT_RUNTIME_ENABLED: "true" } as const;

function fixedDeadline(from: Date, seconds = 3_600): string {
  return new Date(from.getTime() + seconds * 1_000).toISOString();
}

async function seedTask(
  store: AgentTaskStore,
  now: () => Date,
  overrides: { deadlineAt?: string; goal?: string } = {},
): Promise<CreateTaskOutcome> {
  const session = await store.createSession({
    workspaceId: WORKSPACE,
    userId: USER,
  });
  if (!session.ok) return { ok: false, reason: "create_task_error" };

  return store.createTask({
    sessionId: session.sessionId,
    workspaceId: WORKSPACE,
    createdBy: USER,
    goal: overrides.goal ?? "replay the B1 lifecycle",
    deadlineAt: overrides.deadlineAt ?? fixedDeadline(now()),
  });
}

function eventTrace(
  events: readonly { payload: Record<string, unknown> }[],
): string[] {
  return events
    .map((event) => {
      const from = event.payload.from_state;
      const to = event.payload.to_state;
      if (typeof from !== "string" || typeof to !== "string") return null;
      return `${from}->${to}`;
    })
    .filter((entry): entry is string => entry !== null);
}

function throwOnFailure(
  expect: AgentEvalContext["expect"],
  outcome: { ok: boolean },
  code: string,
): void {
  expect(outcome.ok, code);
}

function makePlanStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: "step-eval-1",
    planId: "plan-eval-1",
    seq: 1,
    toolName: "browser.form.submit",
    toolVersion: "1.0.0",
    toolFamily: "browser.form.submit",
    declaredTier: "T4",
    riskScore: null,
    status: "pending",
    attempts: 1,
    maxAttempts: 2,
    timeoutMs: 30_000,
    inputsHash: ZERO_HASH,
    outputsHash: null,
    errorClass: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-11-17T09:00:00.000Z",
    updatedAt: "2026-11-17T09:00:00.000Z",
    ...overrides,
  };
}

function plannerOptions(
  decision: "ALLOW" | "CHALLENGE" | "DENY",
): PlannerOptions {
  return {
    store: {} as never,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    authorizeStep: async () => ({
      decision,
      effectiveTier: "T4",
      requiresApproval: decision !== "ALLOW",
      ttlSeconds: null,
    }),
    recordCheckpoint: async () => undefined,
    now: () => new Date("2026-11-17T09:00:00.000Z"),
  } as unknown as PlannerOptions;
}

function toolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    workspaceId: WORKSPACE,
    actor: USER,
    toolName: "browser.form.submit",
    toolVersion: "1.0.0",
    toolFamily: "browser.form.submit",
    declaredTier: "T4",
    riskScore: null,
    argsHash: ZERO_HASH,
    ...overrides,
  };
}

function engineOptions(
  now: () => Date,
  idFactory: () => string,
  approval: PermissionEngineOptions["findActiveApproval"],
): PermissionEngineOptions {
  return {
    store: createInMemoryPermissionStore({ now, idFactory }),
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    findActiveApproval: approval,
    recordSecurityAlarm: async () => undefined,
    now,
    idFactory,
  };
}

/** SC-01: B1 lifecycle reaches COMPLETE with an ordered transition trace. */
async function sc01(context: AgentEvalContext): Promise<void> {
  const store = createInMemoryAgentStore({ now: context.now });
  const created = await seedTask(store, context.now);
  throwOnFailure(context.expect, created, "sc01_create_task");
  if (!created.ok) return;

  const result = await runAgentTaskOnce(store, RUNTIME_ON, {
    workerId: WORKER,
    now: context.now,
  });

  context.expect(result.status === "completed", "sc01_not_completed");

  const task = await store.getTask(created.task.id);
  context.expect(task?.state === "COMPLETE", "sc01_state_not_complete");

  const trace = eventTrace(await store.listEvents(created.task.id, 0, 200));
  for (const expected of [
    "INTAKE->PLANNING",
    "PLANNING->EXECUTING",
    "EXECUTING->VERIFYING",
    "VERIFYING->COMPLETE",
  ]) {
    context.expect(trace.includes(expected), `sc01_missing_${expected}`);
  }
}

/** SC-02: a lost lease stops the run and no step executes twice. */
async function sc02(context: AgentEvalContext): Promise<void> {
  const base = createInMemoryAgentStore({ now: context.now });
  const created = await seedTask(base, context.now);
  throwOnFailure(context.expect, created, "sc02_create_task");
  if (!created.ok) return;

  let heartbeats = 0;
  const store: AgentTaskStore = {
    ...base,
    async heartbeat(taskId, leaseToken, leaseSeconds) {
      heartbeats += 1;
      if (heartbeats > 1) return { ok: false, reason: "lease_expired" };
      return base.heartbeat(taskId, leaseToken, leaseSeconds);
    },
  };

  const executed: string[] = [];
  const idempotencyKeys: string[] = [];
  const result = await runAgentTaskOnce(store, RUNTIME_ON, {
    workerId: WORKER,
    now: context.now,
    async executeStep(step) {
      executed.push(step.id);
      idempotencyKeys.push(step.idempotencyKey);
      return { mock: true };
    },
  });

  context.expect(result.status === "lease_lost", "sc02_status_not_lease_lost");
  context.expect(executed.length === 1, "sc02_step_duplicated_or_skipped");
  context.expect(
    new Set(idempotencyKeys).size === idempotencyKeys.length,
    "sc02_idempotency_key_reused",
  );
}

/** SC-03: an exceeded deadline fails the task without running any further step. */
async function sc03(context: AgentEvalContext): Promise<void> {
  let nowMs = Date.parse("2026-11-17T09:00:00.000Z");
  const clock = () => new Date(nowMs);
  const store = createInMemoryAgentStore({ now: clock });
  const created = await seedTask(store, clock, {
    deadlineAt: fixedDeadline(clock(), 30),
  });
  throwOnFailure(context.expect, created, "sc03_create_task");
  if (!created.ok) return;

  const executed: number[] = [];
  const result = await runAgentTaskOnce(store, RUNTIME_ON, {
    workerId: WORKER,
    leaseSeconds: 300,
    now: clock,
    executeStep: async (step) => {
      executed.push(step.seq);
      return { mock: true };
    },
    onAfterStep() {
      // The deadline passes after the first step; the next loop must fail the
      // task instead of starting another step.
      nowMs += 120_000;
    },
  });

  context.expect(result.status === "failed", "sc03_not_failed");
  context.expect(
    result.status === "failed" && result.reason === "deadline_exceeded",
    "sc03_reason_not_deadline_exceeded",
  );
  context.expect(executed.length === 1, "sc03_step_ran_after_deadline");

  const task = await store.getTask(created.task.id);
  context.expect(task?.state === "FAILED", "sc03_state_not_failed");
  context.expect(
    task?.failureReason === "deadline_exceeded",
    "sc03_failure_reason_missing",
  );

  const steps = await store.listSteps(created.task.id);
  context.expect(
    steps.filter((step) => step.status === "SUCCEEDED").length === 1,
    "sc03_unexpected_succeeded_steps",
  );
  context.expect(
    steps.filter((step) => step.status === "PENDING").length === steps.length - 1,
    "sc03_step_started_after_deadline",
  );
}

/** SC-04: a cancel observed before a step stops the run cleanly. */
async function sc04(context: AgentEvalContext): Promise<void> {
  const store = createInMemoryAgentStore({ now: context.now });
  const created = await seedTask(store, context.now);
  throwOnFailure(context.expect, created, "sc04_create_task");
  if (!created.ok) return;
  const taskId = created.task.id;

  let executedSteps = 0;
  const result = await runAgentTaskOnce(store, RUNTIME_ON, {
    workerId: WORKER,
    now: context.now,
    async onBeforeStep() {
      await store.requestCancel(taskId, USER);
    },
    executeStep: async () => {
      executedSteps += 1;
      return { mock: true };
    },
  });

  context.expect(result.status === "cancelled", "sc04_status_not_cancelled");
  context.expect(executedSteps === 0, "sc04_step_ran_after_cancel");

  const task = await store.getTask(taskId);
  context.expect(task?.state === "CANCELLED", "sc04_state_not_cancelled");
}

/**
 * SC-05: B3/B4/B5 fail-closed pack.
 *
 * A T4 action without approval is blocked, an approved action proceeds, an
 * expired grant denies, a planner checkpoint denial is not permitted and the
 * memory gate is hard-off outside its exact enablement.
 */
async function sc05(context: AgentEvalContext): Promise<void> {
  const now = () => new Date("2026-11-17T09:00:00.000Z");
  const options = engineOptions(now, context.idFactory, async () => null);

  await options.store.upsertGrant({
    workspaceId: WORKSPACE,
    tier: "T4",
    toolFamily: "browser.form.submit",
    grantedBy: USER,
    scopeNotes: null,
    expiresAt: null,
  });

  const blocked = await authorize(toolCall(), options);
  context.expect(blocked.decision === "CHALLENGE", "sc05_not_challenged");
  context.expect(blocked.requiresApproval, "sc05_approval_not_required");

  const approvedEngine = engineOptions(now, context.idFactory, async () => ({
    id: "approval-eval-1",
    workspaceId: WORKSPACE,
    tier: "T4",
    toolFamily: "browser.form.submit",
    requestedBy: USER,
    scopeNotes: null,
    status: "approved",
    requestedAt: now().toISOString(),
    expiresAt: fixedDeadline(now()),
    decidedAt: now().toISOString(),
    decidedBy: USER,
    decisionEvidenceHash: ZERO_HASH,
  }));
  await approvedEngine.store.upsertGrant({
    workspaceId: WORKSPACE,
    tier: "T4",
    toolFamily: "browser.form.submit",
    grantedBy: USER,
    scopeNotes: null,
    expiresAt: null,
  });
  const approved = await authorize(toolCall(), approvedEngine);
  context.expect(approved.decision === "ALLOW", "sc05_approved_not_allowed");

  const expiredEngine = engineOptions(now, context.idFactory, async () => null);
  await expiredEngine.store.upsertGrant({
    workspaceId: WORKSPACE,
    tier: "T4",
    toolFamily: "browser.form.submit",
    grantedBy: USER,
    scopeNotes: null,
    expiresAt: "2026-11-17T08:00:00.000Z",
  });
  const expired = await authorize(toolCall(), expiredEngine);
  context.expect(expired.decision === "DENY", "sc05_expired_not_denied");

  const checkpoint = await runPreExecutionCheckpoint(
    makePlanStep(),
    plannerOptions("DENY"),
  );
  context.expect(checkpoint.decision === "DENY", "sc05_checkpoint_not_denied");
  context.expect(
    !checkpoint.permitted,
    "sc05_checkpoint_permitted_despite_deny",
  );

  const memory = inspectMemoryGate({ NODE_ENV: "production" });
  context.expect(!memory.enabled, "sc05_memory_gate_enabled_in_production");
}

/** SC-06: B7 mock browser denies off-list before the driver, then allows an approved in-list act. */
async function sc06(context: AgentEvalContext): Promise<void> {
  const target = "https://example.com/form";
  const offList = "https://off-list.example.net/form";

  const driver = createMockDriver({
    pages: { [target]: { title: "Form", dom: "<html><body>form</body></html>" } },
  });
  const evidenceStore = createInMemoryEvidenceStore();
  const policy = createSessionPolicy({
    workspaceId: WORKSPACE,
    allowList: ["example.com"],
  });
  const approvalGate = createApprovalGate({
    resolver: async () => "approved" as const,
    clock: context.now,
  });
  const service = createBrowserService({
    driver,
    policy,
    evidenceStore,
    approvalGate,
    clock: context.now,
  });

  const opened = await service.openSession({
    workspaceId: WORKSPACE,
    taskId: "task-eval-browser",
  });
  if (!opened.ok) {
    context.fail("sc06_session_not_opened");
    return;
  }
  const sessionId = opened.value.sessionId;

  const denied = await service.act(sessionId, {
    action: "navigate",
    targetUrl: offList,
  });
  context.expect(!denied.ok, "sc06_off_list_allowed");
  context.expect(driver.calls.length === 0, "sc06_driver_called_off_list");

  const approval = await approvalGate.request({
    workspaceId: WORKSPACE,
    sessionId,
    action: "submit",
    targetUrl: target,
  });
  if (!approval.ok) {
    context.fail("sc06_approval_not_issued");
    return;
  }

  const acted = await service.act(sessionId, {
    action: "submit",
    targetUrl: target,
    approvalToken: approval.value,
  });
  context.expect(acted.ok, "sc06_approved_act_blocked");
  context.expect(
    acted.ok && acted.value.evidence.length === 2,
    "sc06_evidence_missing",
  );
  context.expect(
    driver.calls.includes(`perform:submit:${target}`),
    "sc06_action_not_performed",
  );
  context.expect(driver.socketsOpened() === 0, "sc06_driver_opened_socket");
  context.expect(driver.launches === 0, "sc06_driver_launched_browser");

  const descriptors = await evidenceStore.listByTask("task-eval-browser");
  context.expect(
    descriptors !== null && descriptors.length === 2,
    "sc06_evidence_descriptor_missing",
  );
  for (const descriptor of descriptors ?? []) {
    context.expect(
      descriptor.workspaceId === WORKSPACE,
      "sc06_evidence_other_workspace",
    );
    context.expect(
      descriptor.screenshotHash.length === 64 &&
        descriptor.domHash.length === 64,
      "sc06_evidence_hash_missing",
    );
  }
}

export const agentEvalScenarioSuites: readonly AgentEvalSuite[] = [
  {
    id: "b8-scenarios",
    category: "scenario",
    cases: [
      { id: "SC-01", run: sc01 },
      { id: "SC-02", run: sc02 },
      { id: "SC-03", run: sc03 },
      { id: "SC-04", run: sc04 },
      { id: "SC-05", run: sc05 },
      { id: "SC-06", run: sc06 },
    ],
  },
];
