import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { buildMockPlan } from "./fsm.ts";
import type { AgentRuntimeEnvironment } from "./gate.ts";
import { runAgentTaskOnce, sha256Hex } from "./runtime.ts";
import {
  createInMemoryAgentStore,
  type AgentTaskStore,
  type InMemoryAgentStore,
} from "./store.ts";

const START = Date.parse("2026-11-08T00:00:00.000Z");

const RUNTIME_ENV: AgentRuntimeEnvironment = {
  AGENT_RUNTIME_ENABLED: "true",
  NODE_ENV: "test",
};

type Clock = {
  now: () => Date;
  advance: (milliseconds: number) => void;
};

function makeClock(): Clock {
  let current = START;
  return {
    now: () => new Date(current),
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  };
}

type Fixture = {
  workspaceId: string;
  userId: string;
  sessionId: string;
  taskId: string;
};

async function createFixture(
  store: InMemoryAgentStore,
  clock: Clock,
  options: { deadlineMs?: number; maxSteps?: number } = {},
): Promise<Fixture> {
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const session = await store.createSession({ workspaceId, userId });
  assert.equal(session.ok, true);
  if (!session.ok) throw new Error("fixture session failed");

  const task = await store.createTask({
    sessionId: session.sessionId,
    workspaceId,
    createdBy: userId,
    goal: "Run a deterministic mock task",
    deadlineAt: new Date(
      clock.now().getTime() + (options.deadlineMs ?? 600_000),
    ).toISOString(),
    maxSteps: options.maxSteps,
  });
  assert.equal(task.ok, true);
  if (!task.ok) throw new Error("fixture task failed");

  return {
    workspaceId,
    userId,
    sessionId: session.sessionId,
    taskId: task.task.id,
  };
}

async function addTask(
  store: InMemoryAgentStore,
  clock: Clock,
  fixture: Fixture,
  goal: string,
): Promise<string> {
  const task = await store.createTask({
    sessionId: fixture.sessionId,
    workspaceId: fixture.workspaceId,
    createdBy: fixture.userId,
    goal,
    deadlineAt: new Date(clock.now().getTime() + 600_000).toISOString(),
  });
  assert.equal(task.ok, true);
  if (!task.ok) throw new Error("fixture task failed");
  return task.task.id;
}

test("kill-switch drill: disabled gate never touches the store", async () => {
  const untouched = new Proxy(
    {},
    {
      get() {
        throw new Error("store must not be touched when the gate is off");
      },
    },
  ) as unknown as AgentTaskStore;

  assert.deepEqual(
    await runAgentTaskOnce(untouched, { AGENT_RUNTIME_ENABLED: "false" }, { workerId: "worker" }),
    { status: "disabled", reason: "flag_off" },
  );

  assert.deepEqual(
    await runAgentTaskOnce(
      untouched,
      { AGENT_RUNTIME_ENABLED: "true", NODE_ENV: "production" },
      { workerId: "worker" },
    ),
    { status: "disabled", reason: "production" },
  );
});

test("idle outcomes are explicit for an empty queue and an invalid worker", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });

  assert.deepEqual(
    await runAgentTaskOnce(store, RUNTIME_ENV, { workerId: "worker-1", now: clock.now }),
    { status: "idle", reason: "no_task" },
  );

  assert.deepEqual(
    await runAgentTaskOnce(store, RUNTIME_ENV, { workerId: "   ", now: clock.now }),
    { status: "idle", reason: "invalid_worker" },
  );
});

test("happy path executes the bounded mock plan and persists ordered events", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
  });

  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.stepsExecuted, 3);

  const task = await store.getTask(fixture.taskId);
  assert.equal(task?.state, "COMPLETE");
  assert.equal(task?.leaseToken, null);
  assert.equal(task?.leaseExpiresAt, null);
  assert.equal(task?.failureReason, null);
  assert.ok(task?.completedAt);

  const steps = await store.listSteps(fixture.taskId);
  assert.equal(steps.length, 3);
  assert.deepEqual(
    steps.map((step) => step.status),
    ["SUCCEEDED", "SUCCEEDED", "SUCCEEDED"],
  );
  assert.deepEqual(
    steps.map((step) => step.attempts),
    [1, 1, 1],
  );

  const events = store.snapshot().events.filter((event) => event.taskId === fixture.taskId);
  assert.deepEqual(
    events.map((event) => event.seq),
    events.map((_, index) => index + 1),
  );
  assert.equal(events.filter((event) => event.type === "task_claimed").length, 1);
  assert.equal(events.filter((event) => event.type === "step_succeeded").length, 3);
  assert.equal(events.filter((event) => event.type === "task_completed").length, 1);
  assert.ok(events.every((event) => !("goal" in event.payload)));
});

test("crash recovery resumes at the first non-terminal step without re-running completed steps", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const claim = await store.claimTask("worker-a", 60);
  assert.equal(claim.ok, true);
  if (!claim.ok) return;

  const planned = await store.planSteps(
    fixture.taskId,
    buildMockPlan("Run a deterministic mock task", 25, sha256Hex),
  );
  assert.equal(planned.ok, true);

  const toPlanning = await store.transition({
    taskId: fixture.taskId,
    leaseToken: claim.leaseToken,
    from: "INTAKE",
    to: "PLANNING",
  });
  assert.equal(toPlanning.ok, true);
  const toExecuting = await store.transition({
    taskId: fixture.taskId,
    leaseToken: claim.leaseToken,
    from: "PLANNING",
    to: "EXECUTING",
  });
  assert.equal(toExecuting.ok, true);

  const steps = await store.listSteps(fixture.taskId);
  assert.equal(steps.length, 3);
  assert.equal(
    (await store.recordStep({
      taskId: fixture.taskId,
      leaseToken: claim.leaseToken,
      stepId: steps[0].id,
      status: "RUNNING",
    })).ok,
    true,
  );
  assert.equal(
    (await store.recordStep({
      taskId: fixture.taskId,
      leaseToken: claim.leaseToken,
      stepId: steps[0].id,
      status: "SUCCEEDED",
    })).ok,
    true,
  );
  assert.equal(
    (await store.recordStep({
      taskId: fixture.taskId,
      leaseToken: claim.leaseToken,
      stepId: steps[1].id,
      status: "RUNNING",
    })).ok,
    true,
  );

  // The first worker dies without releasing; its lease expires.
  clock.advance(61_000);

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-b",
    leaseSeconds: 60,
    now: clock.now,
  });

  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;

  const finalSteps = await store.listSteps(fixture.taskId);
  assert.equal(finalSteps[0].status, "SUCCEEDED");
  assert.equal(finalSteps[0].attempts, 1, "completed step must not be re-executed");
  assert.equal(finalSteps[1].status, "SUCCEEDED");
  assert.equal(finalSteps[1].attempts, 2, "interrupted step is retried exactly once");
  assert.equal(finalSteps[2].status, "SUCCEEDED");

  const events = store.snapshot().events.filter((event) => event.taskId === fixture.taskId);
  const reclaimed = events.filter((event) => event.type === "task_lease_reclaimed");
  assert.equal(reclaimed.length, 1);
  assert.equal(reclaimed[0].payload.requeued_steps, 1);
  assert.equal(events.filter((event) => event.type === "step_succeeded").length, 3);
});

test("an expired deadline fails the task with durable evidence", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock, { deadlineMs: 30_000 });

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
    onBeforeStep: () => {
      clock.advance(31_000);
    },
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.reason, "deadline_exceeded");

  const task = await store.getTask(fixture.taskId);
  assert.equal(task?.state, "FAILED");
  assert.equal(task?.failureReason, "deadline_exceeded");
  assert.equal(task?.evidence.reason, "deadline_exceeded");
  assert.equal(task?.leaseToken, null);

  const events = store.snapshot().events.filter((event) => event.taskId === fixture.taskId);
  assert.ok(events.some((event) => event.type === "task_failed"));
});

test("the per-workspace lease cap is exactly two", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now, workspaceCap: 2 });
  const fixture = await createFixture(store, clock);
  await addTask(store, clock, fixture, "Second workspace task");
  await addTask(store, clock, fixture, "Third workspace task");

  const first = await store.claimTask("worker-1", 60);
  const second = await store.claimTask("worker-2", 60);
  const third = await store.claimTask("worker-3", 60);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(third, { ok: false, reason: "none" });
});

test("the global lease cap is enforced across workspaces", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now, globalCap: 1 });
  await createFixture(store, clock);
  await createFixture(store, clock);

  const first = await store.claimTask("worker-1", 60);
  const second = await store.claimTask("worker-2", 60);

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ok: false, reason: "none" });
});

test("cancel before claim completes immediately and prevents execution", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const cancel = await store.requestCancel(fixture.taskId, fixture.userId);
  assert.equal(cancel.ok, true);
  if (cancel.ok) assert.equal(cancel.reason, "cancelled");

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
  });

  assert.deepEqual(result, { status: "idle", reason: "no_task" });
  assert.equal((await store.getTask(fixture.taskId))?.state, "CANCELLED");
});

test("cancel between steps stops the run cooperatively", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
    onAfterStep: async (step, task) => {
      if (step.seq === 1) {
        await store.requestCancel(task.id, fixture.userId);
      }
    },
  });

  assert.equal(result.status, "cancelled");
  if (result.status !== "cancelled") return;
  assert.equal(result.stepsExecuted, 1);
  assert.equal((await store.getTask(fixture.taskId))?.state, "CANCELLED");

  const steps = await store.listSteps(fixture.taskId);
  assert.equal(steps[0].status, "SUCCEEDED");
  assert.equal(steps[1].status, "PENDING");
});

test("cancel racing a running step marks that step cancelled", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
    onBeforeStep: async (step, task) => {
      assert.equal(step.seq, 1);
      await store.requestCancel(task.id, fixture.userId);
    },
  });

  assert.equal(result.status, "cancelled");
  if (result.status !== "cancelled") return;
  assert.equal(result.stepsExecuted, 0);

  const steps = await store.listSteps(fixture.taskId);
  assert.equal(steps[0].status, "CANCELLED");
  assert.equal((await store.getTask(fixture.taskId))?.state, "CANCELLED");
});

test("lease loss ends the run without recording a successful step", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
    onBeforeStep: () => {
      clock.advance(61_000);
    },
  });

  assert.equal(result.status, "lease_lost");
  if (result.status !== "lease_lost") return;
  assert.equal(result.stepsExecuted, 0);

  const steps = await store.listSteps(fixture.taskId);
  assert.equal(steps[0].status, "RUNNING");
  assert.equal((await store.getTask(fixture.taskId))?.state, "EXECUTING");
});

test("a step timeout fails the task with a step_timeout reason", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
    stepTimeoutMs: 100,
    executeStep: () => new Promise<Record<string, unknown>>(() => {}),
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.reason, "step_timeout");

  const task = await store.getTask(fixture.taskId);
  assert.equal(task?.state, "FAILED");
  assert.equal(task?.failureReason, "step_timeout");
  assert.equal(task?.leaseToken, null);
});

test("a task waiting on a human is released, never guessed", async () => {
  const clock = makeClock();
  const store = createInMemoryAgentStore({ now: clock.now });
  const fixture = await createFixture(store, clock);

  const claim = await store.claimTask("worker-a", 60);
  assert.equal(claim.ok, true);
  if (!claim.ok) return;

  const moved = await store.transition({
    taskId: fixture.taskId,
    leaseToken: claim.leaseToken,
    from: "INTAKE",
    to: "CLARIFY",
  });
  assert.equal(moved.ok, true);
  assert.equal((await store.release(fixture.taskId, claim.leaseToken)).ok, true);

  const result = await runAgentTaskOnce(store, RUNTIME_ENV, {
    workerId: "worker-1",
    now: clock.now,
  });

  assert.deepEqual(result, { status: "idle", reason: "awaiting_human" });
  assert.equal((await store.getTask(fixture.taskId))?.state, "CLARIFY");
  assert.equal((await store.getTask(fixture.taskId))?.leaseToken, null);
});
