/**
 * B8 observability summary route tests (matrix OB-01 … OB-08).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { computeObservabilitySummary } from "../../../../../lib/agent/observability/metrics.ts";
import type { ObservabilitySummary } from "../../../../../lib/agent/observability/types.ts";
import {
  createSummaryHandler,
  readWorkspaceSummary,
  type ObservabilityClient,
  type SummaryRouteDeps,
} from "./route.ts";

const ON = {
  NODE_ENV: "test",
  AGENT_OBSERVABILITY_ENABLED: "true",
  AGENT_RUNTIME_ENABLED: "true",
} as const;

type Payload = { data: unknown; error: unknown };

type Recording = {
  authCalls: number;
  clientCalls: number;
  workspaceCalls: number;
  summaryCalls: number;
};

function quiet(): Recording {
  return { authCalls: 0, clientCalls: 0, workspaceCalls: 0, summaryCalls: 0 };
}

function sampleSummary(): ObservabilitySummary {
  return computeObservabilitySummary({
    tasks: [
      { state: "COMPLETE", failureReason: null, tier: "T1", durationMs: 100 },
      { state: "FAILED", failureReason: "deadline_exceeded", tier: "T4", durationMs: 300 },
    ],
    audits: [
      { status: "SUCCEEDED", errorClass: null, durationMs: 10 },
      { status: "FAILED", errorClass: "TIMEOUT", durationMs: 20 },
    ],
    usage: [{ costEstimateUsd: 1.25 }],
    budgetCeilingUsd: null,
    retentionConfigured: false,
  });
}

function deps(
  overrides: Partial<SummaryRouteDeps> = {},
  recording: Recording = quiet(),
): SummaryRouteDeps {
  return {
    environment: ON,
    async getAuthenticatedUser() {
      recording.authCalls += 1;
      return { id: "user-1" };
    },
    async createClient() {
      recording.clientCalls += 1;
      return {} as ObservabilityClient;
    },
    async getCurrentWorkspace() {
      recording.workspaceCalls += 1;
      return { data: { id: "ws-1" }, error: null };
    },
    async readSummary() {
      recording.summaryCalls += 1;
      return sampleSummary();
    },
    ...overrides,
  };
}

function fakeClient(tables: Record<string, Payload>): ObservabilityClient {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          const payload = tables[table] ?? { data: [], error: null };
          return {
            async eq() {
              return payload;
            },
            then: Promise.resolve(payload).then.bind(Promise.resolve(payload)),
          };
        },
      };
    },
  } as unknown as ObservabilityClient;
}

test("OB-01 the flag off returns 404 before any auth or store read", async () => {
  const recording = quiet();
  const handler = createSummaryHandler(
    deps({ environment: { NODE_ENV: "test" } }, recording),
  );

  const response = await handler();
  assert.equal(response.status, 404);
  assert.deepEqual(recording, quiet());
});

test("OB-02 production is hard-off even with both flags copied in", async () => {
  const recording = quiet();
  const handler = createSummaryHandler(
    deps({ environment: { ...ON, VERCEL_ENV: "production" } }, recording),
  );

  assert.equal((await handler()).status, 404);
  assert.deepEqual(recording, quiet());
});

test("OB-02 the runtime flag must also be on", async () => {
  const handler = createSummaryHandler(
    deps({ environment: { NODE_ENV: "test", AGENT_OBSERVABILITY_ENABLED: "true" } }),
  );

  assert.equal((await handler()).status, 404);
});

test("OB-03 an unauthenticated caller gets 401 and no store read", async () => {
  const recording = quiet();
  const handler = createSummaryHandler(
    deps({ async getAuthenticatedUser() {
      recording.authCalls += 1;
      return null;
    } }, recording),
  );

  assert.equal((await handler()).status, 401);
  assert.equal(recording.authCalls, 1);
  assert.equal(recording.workspaceCalls, 0);
  assert.equal(recording.summaryCalls, 0);
});

test("OB-04 unknown and errored workspaces share one uniform 404 body", async () => {
  const unknown = createSummaryHandler(
    deps({
      async getCurrentWorkspace() {
        return { data: null, error: "No workspace is assigned to this account." };
      },
    }),
  );
  const errored = createSummaryHandler(
    deps({
      async getCurrentWorkspace() {
        return { data: null, error: "Could not load your workspace." };
      },
    }),
  );

  const first = await unknown();
  const second = await errored();
  assert.equal(first.status, 404);
  assert.equal(second.status, 404);
  assert.equal(await first.text(), await second.text());
});

test("OB-05 the response schema is content-free and exactly bounded", async () => {
  const secret = "CUSTOMER-SECRET-URL-https://example.com/private";
  const recording = quiet();
  const handler = createSummaryHandler(
    deps(
      {
        async readSummary() {
          recording.summaryCalls += 1;
          return computeObservabilitySummary({
            tasks: [
              {
                state: "FAILED",
                failureReason: `${secret} token=abc`,
                tier: "T2",
                durationMs: 12,
              },
            ],
            audits: [
              { status: "FAILED", errorClass: secret, durationMs: 5 },
            ],
            usage: [{ costEstimateUsd: 0.5 }],
            budgetCeilingUsd: null,
            retentionConfigured: false,
          });
        },
      },
      recording,
    ),
  );

  const response = await handler();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  const body = await response.text();

  assert.equal(body.includes("example.com"), false);
  assert.equal(body.includes("token=abc"), false);
  assert.equal(body.includes("CUSTOMER-SECRET"), false);

  const parsed = JSON.parse(body) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed), [
    "dataComplete",
    "tasks",
    "audits",
    "budget",
    "retention",
  ]);
  assert.equal(parsed.dataComplete, true);
});

test("OB-06 the reader maps fixed rows to exact aggregates and ignores goal text", async () => {
  const client = fakeClient({
    agent_tasks: {
      data: [
        {
          id: "task-1",
          state: "COMPLETE",
          failure_reason: null,
          created_at: "2026-11-17T09:00:00.000Z",
          completed_at: "2026-11-17T09:00:01.000Z",
          goal: "CUSTOMER-SECRET-GOAL",
        },
        {
          id: "task-2",
          state: "FAILED",
          failure_reason: "deadline_exceeded",
          created_at: "2026-11-17T09:00:00.000Z",
          completed_at: "2026-11-17T09:00:00.300Z",
          goal: "CUSTOMER-SECRET-GOAL",
        },
      ],
      error: null,
    },
    agent_tool_invocations: {
      data: [
        { status: "SUCCEEDED", error_class: null, duration_ms: 10, args_hash: "a".repeat(64) },
        { status: "FAILED", error_class: "TIMEOUT", duration_ms: 20, args_hash: "b".repeat(64) },
        { status: "FAILED", error_class: "TIMEOUT", duration_ms: 40, args_hash: "c".repeat(64) },
      ],
      error: null,
    },
    agent_usage_ledger: {
      data: [{ cost_estimate_usd: 0.75 }, { cost_estimate_usd: 0.25 }],
      error: null,
    },
    agent_plan_steps: {
      data: [
        { declared_tier: "T1", plan: { task_id: "task-1" } },
        { declared_tier: "T4", plan: { task_id: "task-2" } },
      ],
      error: null,
    },
  });

  const summary = await readWorkspaceSummary(client, "ws-1");

  assert.equal(summary.tasks.total, 2);
  assert.equal(summary.tasks.byStatus.COMPLETE, 1);
  assert.equal(summary.tasks.byStatus.FAILED, 1);
  assert.deepEqual(summary.tasks.byErrorClass, { deadline_exceeded: 1 });
  assert.equal(summary.tasks.byTier.T1, 1);
  assert.equal(summary.tasks.byTier.T4, 1);
  assert.deepEqual(summary.tasks.durations, {
    sampleSize: 2,
    p50Ms: 300,
    p95Ms: 1000,
    maxMs: 1000,
  });
  assert.equal(summary.audits.total, 3);
  assert.deepEqual(summary.audits.byStatus, { failed: 2, succeeded: 1 });
  assert.deepEqual(summary.audits.byErrorClass, { timeout: 2 });
  assert.deepEqual(summary.audits.durations, {
    sampleSize: 3,
    p50Ms: 20,
    p95Ms: 40,
    maxMs: 40,
  });
  assert.equal(summary.budget.spentUsd, 1);
  assert.equal(summary.budget.status, "unconfigured");
  assert.equal(summary.retention.status, "unconfigured");
  assert.equal(JSON.stringify(summary).includes("CUSTOMER-SECRET-GOAL"), false);
});

test("OB-07 an empty store returns all zeros with dataComplete true", async () => {
  const handler = createSummaryHandler(
    deps({
      readSummary: (client, workspaceId) => readWorkspaceSummary(client, workspaceId),
      async createClient() {
        return fakeClient({});
      },
    }),
  );

  const response = await handler();
  assert.equal(response.status, 200);
  const summary = (await response.json()) as ObservabilitySummary;

  assert.equal(summary.dataComplete, true);
  assert.equal(summary.tasks.total, 0);
  assert.equal(Object.values(summary.tasks.byStatus).every((value) => value === 0), true);
  assert.deepEqual(summary.tasks.byErrorClass, {});
  assert.equal(summary.audits.total, 0);
  assert.equal(summary.budget.spentUsd, 0);
  assert.equal(summary.budget.status, "unconfigured");
});

test("OB-08 a store read error is a typed 503 with no fabricated numbers", async () => {
  const handler = createSummaryHandler(
    deps({
      readSummary: (client, workspaceId) => readWorkspaceSummary(client, workspaceId),
      async createClient() {
        return fakeClient({
          agent_tasks: { data: null, error: { message: "boom" } },
        });
      },
    }),
  );

  const response = await handler();
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { status: "unavailable" });
  assert.equal(body.includes("tasks"), false);
});
