/**
 * B8 watchdog route tests (matrix WD-07 plus read-only coverage for WD-01 … WD-06).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createWatchdogHandler,
  readWorkspaceReport,
  type ObservabilityClient,
  type WatchdogRouteDeps,
} from "./route.ts";
import type { WatchdogReport } from "../../../../../lib/agent/observability/types.ts";

const ON = {
  NODE_ENV: "test",
  AGENT_OBSERVABILITY_ENABLED: "true",
  AGENT_RUNTIME_ENABLED: "true",
} as const;

const NOW = new Date("2026-11-17T09:00:00.000Z");

type Payload = { data: unknown; error: unknown };

type Recording = {
  authCalls: number;
  clientCalls: number;
  workspaceCalls: number;
  reportCalls: number;
};

function quiet(): Recording {
  return { authCalls: 0, clientCalls: 0, workspaceCalls: 0, reportCalls: 0 };
}

const unconfiguredReport: WatchdogReport = {
  status: "unconfigured",
  alerts: [],
  unconfigured: [
    "budget_breach",
    "repeated_failures",
    "stale_lease",
    "stuck_verifying",
  ],
  thresholds: {
    staleLeaseSeconds: null,
    stuckVerifyingSeconds: null,
    consecutiveFailures: null,
    budgetCeilingUsd: null,
  },
};

function deps(
  overrides: Partial<WatchdogRouteDeps> = {},
  recording: Recording = quiet(),
): WatchdogRouteDeps {
  return {
    environment: ON,
    now: () => NOW,
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
    async readReport() {
      recording.reportCalls += 1;
      return unconfiguredReport;
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

test("WD-07 the flag off returns 404 before any auth or store read", async () => {
  const recording = quiet();
  const handler = createWatchdogHandler(
    deps({ environment: { NODE_ENV: "test" } }, recording),
  );

  assert.equal((await handler()).status, 404);
  assert.deepEqual(recording, quiet());
});

test("WD-07 production is hard-off even when both flags are copied in", async () => {
  const recording = quiet();
  const handler = createWatchdogHandler(
    deps({ environment: { ...ON, NODE_ENV: "production" } }, recording),
  );

  assert.equal((await handler()).status, 404);
  assert.deepEqual(recording, quiet());
});

test("WD-07 an unauthenticated caller gets 401 and no store read", async () => {
  const recording = quiet();
  const handler = createWatchdogHandler(
    deps({ async getAuthenticatedUser() {
      recording.authCalls += 1;
      return null;
    } }, recording),
  );

  assert.equal((await handler()).status, 401);
  assert.equal(recording.workspaceCalls, 0);
  assert.equal(recording.reportCalls, 0);
});

test("WD-07 unknown and errored workspaces share one uniform 404 body", async () => {
  const unknown = createWatchdogHandler(
    deps({
      async getCurrentWorkspace() {
        return { data: null, error: "No workspace is assigned to this account." };
      },
    }),
  );
  const errored = createWatchdogHandler(
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

test("WD-07 the route returns the read-only report and never writes", async () => {
  const writes: string[] = [];
  const readOnly = {
    from(table: string) {
      return {
        select(columns: string) {
          writes.push(`select:${table}:${columns}`);
          return {
            async eq() {
              return { data: [], error: null };
            },
          };
        },
      };
    },
  } as unknown as ObservabilityClient;

  const handler = createWatchdogHandler(
    deps({
      async createClient() {
        return readOnly;
      },
      readReport: (client, workspaceId) =>
        readWorkspaceReport(client, workspaceId, () => NOW, ON),
    }),
  );

  const response = await handler();
  assert.equal(response.status, 200);
  const report = (await response.json()) as WatchdogReport;
  assert.equal(report.status, "unconfigured");
  assert.deepEqual(report.alerts, []);
  assert.equal(writes.length, 2);
  assert.equal(writes.every((entry) => entry.startsWith("select:")), true);
});

test("WD-07 a configured threshold surfaces an alert through the reader", async () => {
  const handler = createWatchdogHandler(
    deps({
      environment: {
        ...ON,
        AGENT_WATCHDOG_STALE_LEASE_SECONDS: "120",
      },
      async createClient() {
        return fakeClient({
          agent_tasks: {
            data: [
              {
                id: "task-stale",
                state: "EXECUTING",
                lease_expires_at: "2026-11-17T08:57:59.000Z",
                updated_at: "2026-11-17T08:57:59.000Z",
              },
            ],
            error: null,
          },
        });
      },
      readReport: (client, workspaceId) =>
        readWorkspaceReport(client, workspaceId, () => NOW, {
          ...ON,
          AGENT_WATCHDOG_STALE_LEASE_SECONDS: "120",
        }),
    }),
  );

  const response = await handler();
  assert.equal(response.status, 200);
  const report = (await response.json()) as WatchdogReport;
  assert.deepEqual(report.alerts, [
    { kind: "stale_lease", taskId: "task-stale", threshold: 120 },
  ]);
  assert.equal(report.status, "alert");
});

test("WD-07 a store read error is a typed 503 with no fabricated alerts", async () => {
  const handler = createWatchdogHandler(
    deps({
      async createClient() {
        return fakeClient({
          agent_tasks: { data: null, error: { message: "boom" } },
        });
      },
      readReport: (client, workspaceId) =>
        readWorkspaceReport(client, workspaceId, () => NOW, ON),
    }),
  );

  const response = await handler();
  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(await response.text()), { status: "unavailable" });
});
