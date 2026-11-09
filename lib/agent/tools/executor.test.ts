import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryToolAuditStore,
  type ToolInvocationAuditStore,
} from "./audit.ts";
import { createMockToolAdapters } from "./adapters.ts";
import { ToolError } from "./errors.ts";
import { executeToolInvocation, type ToolExecutionRequest } from "./executor.ts";
import { hashJson } from "./hash.ts";
import { loadToolRegistry, type ToolRegistry } from "./registry.ts";
import {
  TOOL_TIMEOUT_POLICY,
  toolAdapterKey,
  type ToolAdapters,
} from "./types.ts";

const enabled = { AGENT_TOOL_REGISTRY_ENABLED: "true" };

function reviewedRegistry(): ToolRegistry {
  const loaded = loadToolRegistry(enabled);
  if (!loaded.ok) throw new Error("test registry did not load");
  return loaded.registry;
}

function fixedAuditStore() {
  let counter = 0;
  return createInMemoryToolAuditStore({
    now: () => new Date("2026-11-09T00:00:00.000Z"),
    idFactory: () => `audit-${(counter += 1)}`,
  });
}

function baseRequest(
  overrides: Partial<ToolExecutionRequest> = {},
): ToolExecutionRequest {
  return {
    workspaceId: "workspace-a",
    invocationKey: "invocation-1",
    toolName: "workspace.file.read",
    toolVersion: "1.0.0",
    input: { path: "notes.txt" },
    ...overrides,
  };
}

test("successful invocation writes one complete, content-free audit row", async () => {
  const auditStore = fixedAuditStore();
  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: createMockToolAdapters(),
      auditStore,
      now: () => new Date("2026-11-09T00:00:00.000Z"),
    },
    baseRequest({ taskId: "task-1", stepId: "step-1" }),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.output.path, "notes.txt");
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.auditIds, ["audit-1"]);

  const rows = await auditStore.list("workspace-a");
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.status, "SUCCEEDED");
  assert.equal(row.errorClass, null);
  assert.equal(row.attempt, 1);
  assert.equal(row.timeoutClass, "fast");
  assert.equal(row.taskId, "task-1");
  assert.equal(row.stepId, "step-1");
  assert.match(row.argsHash, /^[0-9a-f]{64}$/);
  assert.match(row.outputHash ?? "", /^[0-9a-f]{64}$/);
  assert.match(row.manifestHash, /^[0-9a-f]{64}$/);
  assert.equal(row.argsHash, hashJson({ path: "notes.txt" }));
  assert.equal(row.durationMs, 0);

  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes("notes.txt"), false);
  assert.equal(serialized.includes("contentHash"), false);
});

test("input validation failure is audited and never calls the adapter", async () => {
  const auditStore = fixedAuditStore();
  const adapters = createMockToolAdapters();
  let called = false;
  const spied: ToolAdapters = {
    ...adapters,
    [toolAdapterKey("workspace.file.read", "1.0.0")]: async () => {
      called = true;
      throw new Error("adapter must not run");
    },
  };

  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: spied,
      auditStore,
    },
    baseRequest({ input: { path: "notes.txt", extra: true } }),
  );

  assert.equal(called, false);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "VALIDATION");
  assert.equal(result.code, "input_invalid");
  assert.equal(result.attempts, 1);

  const rows = await auditStore.list("workspace-a");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "FAILED");
  assert.equal(rows[0].errorClass, "VALIDATION");
  assert.equal(rows[0].outputHash, null);
});

test("unknown tool is rejected before any adapter or audit write", async () => {
  const auditStore = fixedAuditStore();
  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: createMockToolAdapters(),
      auditStore,
    },
    baseRequest({ toolName: "unknown.tool", toolVersion: "1.0.0" }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "VALIDATION");
  assert.equal(result.code, "manifest_missing");
  assert.equal(result.attempts, 0);
  assert.deepEqual(result.auditIds, []);
  assert.deepEqual(await auditStore.list("workspace-a"), []);
});

test("closed calendar gate yields PERMISSION with one audited attempt", async () => {
  const auditStore = fixedAuditStore();
  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: createMockToolAdapters(),
      auditStore,
    },
    baseRequest({
      invocationKey: "calendar-1",
      toolName: "calendar.events.read",
      toolVersion: "1.0.0",
      input: {
        timeMin: "2026-11-09T09:00:00.000Z",
        timeMax: "2026-11-09T10:00:00.000Z",
      },
    }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "PERMISSION");
  assert.equal(result.code, "calendar_gate_closed");
  assert.equal(result.attempts, 1);

  const rows = await auditStore.list("workspace-a");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "FAILED");
  assert.equal(rows[0].errorClass, "PERMISSION");
});

test("rate-limit failures retry within the standard class and audit each attempt", async () => {
  const auditStore = fixedAuditStore();
  const adapters = createMockToolAdapters();
  let calls = 0;
  const retrying: ToolAdapters = {
    ...adapters,
    [toolAdapterKey("web.research.search", "1.0.0")]: async () => {
      calls += 1;
      if (calls === 1) {
        throw new ToolError("RATE_LIMIT", "rate_limited");
      }
      return { queryHash: "a".repeat(64), results: [] };
    },
  };

  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: retrying,
      auditStore,
      sleep: async () => {},
    },
    baseRequest({
      invocationKey: "web-1",
      toolName: "web.research.search",
      toolVersion: "1.0.0",
      input: { query: "workspace research" },
    }),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.attempts, 2);
  assert.equal(result.auditIds.length, 2);

  const rows = await auditStore.list("workspace-a");
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.status),
    ["FAILED", "SUCCEEDED"],
  );
  assert.deepEqual(
    rows.map((row) => row.errorClass),
    ["RATE_LIMIT", null],
  );
});

test("per-class timeout is honored and audited as TIMEOUT", async () => {
  const auditStore = fixedAuditStore();
  const adapters = createMockToolAdapters();
  const hanging: ToolAdapters = {
    ...adapters,
    [toolAdapterKey("workspace.file.read", "1.0.0")]: async () =>
      new Promise<Record<string, unknown>>(() => {}),
  };

  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: hanging,
      auditStore,
      timeoutMsByClass: { fast: 10 },
    },
    baseRequest({ invocationKey: "timeout-1" }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "TIMEOUT");
  assert.equal(result.code, "timeout");
  assert.equal(result.attempts, 1);

  const rows = await auditStore.list("workspace-a");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].errorClass, "TIMEOUT");
});

test("upstream retries are exhausted and every attempt is audited", async () => {
  const auditStore = fixedAuditStore();
  const adapters = createMockToolAdapters();
  const failing: ToolAdapters = {
    ...adapters,
    [toolAdapterKey("web.research.search", "1.0.0")]: async () => {
      throw new ToolError("UPSTREAM", "upstream_down");
    },
  };

  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: failing,
      auditStore,
      sleep: async () => {},
    },
    baseRequest({
      invocationKey: "web-2",
      toolName: "web.research.search",
      toolVersion: "1.0.0",
      input: { query: "research" },
    }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "UPSTREAM");
  assert.equal(result.code, "upstream_down");
  assert.equal(result.attempts, 2);
  assert.equal((await auditStore.list("workspace-a")).length, 2);
});

test("non-retryable internal failures stop after one attempt", async () => {
  const auditStore = fixedAuditStore();
  const adapters = createMockToolAdapters();
  const failing: ToolAdapters = {
    ...adapters,
    [toolAdapterKey("web.research.search", "1.0.0")]: async () => {
      throw new Error("raw internal detail");
    },
  };

  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: failing,
      auditStore,
      sleep: async () => {},
    },
    baseRequest({
      invocationKey: "web-3",
      toolName: "web.research.search",
      toolVersion: "1.0.0",
      input: { query: "research" },
    }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "INTERNAL");
  assert.equal(result.code, "unexpected_error");
  assert.equal(result.attempts, 1);

  const serialized = JSON.stringify(await auditStore.list("workspace-a"));
  assert.equal(serialized.includes("raw internal detail"), false);
});

test("output contract violations fail closed instead of reporting success", async () => {
  const auditStore = fixedAuditStore();
  const adapters = createMockToolAdapters();
  const badOutput: ToolAdapters = {
    ...adapters,
    [toolAdapterKey("workspace.file.read", "1.0.0")]: async () => ({
      path: "notes.txt",
      unexpected: true,
    }),
  };

  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: badOutput,
      auditStore,
    },
    baseRequest({ invocationKey: "output-1" }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "INTERNAL");
  assert.equal(result.code, "output_invalid");
  assert.equal(result.attempts, 1);

  const rows = await auditStore.list("workspace-a");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "FAILED");
  assert.equal(rows[0].outputHash, null);
});

test("audit write failure fails the invocation closed", async () => {
  const failingAudit: ToolInvocationAuditStore = {
    async record() {
      return { ok: false, reason: "audit_down" };
    },
    async list() {
      return [];
    },
  };

  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: createMockToolAdapters(),
      auditStore: failingAudit,
    },
    baseRequest({ invocationKey: "audit-1" }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "INTERNAL");
  assert.equal(result.code, "audit_write_failed");
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.auditIds, []);
});

test("invalid invocation keys are rejected before execution", async () => {
  const auditStore = fixedAuditStore();
  const result = await executeToolInvocation(
    {
      registry: reviewedRegistry(),
      adapters: createMockToolAdapters(),
      auditStore,
    },
    baseRequest({ invocationKey: "bad key with spaces" }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorClass, "VALIDATION");
  assert.equal(result.code, "invalid_invocation_key");
  assert.equal(result.attempts, 0);
  assert.deepEqual(await auditStore.list("workspace-a"), []);
});

test("reviewed timeout/retry policy matches the signed classes", () => {
  assert.deepEqual(TOOL_TIMEOUT_POLICY.fast, {
    timeoutMs: 5_000,
    maxAttempts: 1,
    backoffMs: 0,
  });
  assert.deepEqual(TOOL_TIMEOUT_POLICY.standard, {
    timeoutMs: 30_000,
    maxAttempts: 2,
    backoffMs: 250,
  });
  assert.deepEqual(TOOL_TIMEOUT_POLICY.long, {
    timeoutMs: 120_000,
    maxAttempts: 2,
    backoffMs: 1_000,
  });
});
