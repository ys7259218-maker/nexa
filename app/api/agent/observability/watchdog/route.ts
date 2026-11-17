import { inspectAgentObservabilityGate } from "../../../../../lib/agent/observability/gate.ts";
import {
  evaluateWatchdog,
  readWatchdogThresholds,
} from "../../../../../lib/agent/observability/watchdog.ts";
import type {
  WatchdogReport,
  WatchdogTaskRow,
} from "../../../../../lib/agent/observability/types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * B8 read-only advisory watchdog (scope C6, matrix WD-01 … WD-07).
 *
 * Same double gate, auth and RLS rules as the summary route. The watchdog only
 * observes: there is no requeue, cancel, kill, retry or flag flip anywhere in
 * this file or its dependencies.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ObservabilityQueryResult = Readonly<{
  data: unknown;
  error: unknown;
}>;

export type ObservabilityQuery = PromiseLike<ObservabilityQueryResult> & {
  eq(column: string, value: string): PromiseLike<ObservabilityQueryResult>;
};

export type ObservabilityClient = Readonly<{
  from(table: string): {
    select(columns: string): ObservabilityQuery;
  };
}>;

export type WorkspaceLookup = Readonly<{
  data: Readonly<{ id: string }> | null;
  error: string | null;
}>;

export type WatchdogRouteDeps = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  now: () => Date;
  getAuthenticatedUser: () => Promise<Readonly<{ id: string }> | null>;
  createClient: () => Promise<ObservabilityClient | null>;
  getCurrentWorkspace: (
    client: ObservabilityClient,
  ) => Promise<WorkspaceLookup>;
  readReport: (
    client: ObservabilityClient,
    workspaceId: string,
  ) => Promise<WatchdogReport>;
}>;

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

function unavailable(): Response {
  return new Response(JSON.stringify({ status: "unavailable" }), {
    status: 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function ok(body: WatchdogReport): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export function createWatchdogHandler(
  deps: WatchdogRouteDeps,
): () => Promise<Response> {
  return async function handler(): Promise<Response> {
    const gate = inspectAgentObservabilityGate(deps.environment);
    if (!gate.enabled) return notFound();

    const user = await deps.getAuthenticatedUser();
    if (!user) return unauthorized();

    const client = await deps.createClient();
    if (!client) return notFound();

    const workspace = await deps.getCurrentWorkspace(client);
    if (workspace.error !== null || workspace.data === null) return notFound();

    try {
      const report = await deps.readReport(client, workspace.data.id);
      return ok(report);
    } catch {
      return unavailable();
    }
  };
}

type Row = Record<string, unknown>;

function rows(data: unknown): Row[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (entry): entry is Row =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function readWorkspaceReport(
  client: ObservabilityClient,
  workspaceId: string,
  now: () => Date,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<WatchdogReport> {
  const tasksResult = await client
    .from("agent_tasks")
    .select("id,state,lease_expires_at,updated_at")
    .eq("workspace_id", workspaceId);
  if (tasksResult.error) throw new Error("watchdog_read_failed");

  const usageResult = await client
    .from("agent_usage_ledger")
    .select("cost_estimate_usd")
    .eq("workspace_id", workspaceId);
  if (usageResult.error) throw new Error("watchdog_read_failed");

  const taskRows = rows(tasksResult.data);
  const ordered = [...taskRows].sort((left, right) =>
    (text(right.updated_at) ?? "").localeCompare(text(left.updated_at) ?? ""),
  );

  let streak = 0;
  for (const row of ordered) {
    if (text(row.state) === "FAILED") streak += 1;
    else break;
  }

  const tasks: WatchdogTaskRow[] = taskRows
    .map((row) => {
      const taskId = text(row.id);
      const state = text(row.state);
      if (taskId === null || state === null) return null;
      return {
        taskId,
        state,
        leaseExpiresAt: text(row.lease_expires_at),
        verifyingSince:
          state === "VERIFYING" ? text(row.updated_at) : null,
        consecutiveFailures: state === "FAILED" ? streak : 0,
      } satisfies WatchdogTaskRow;
    })
    .filter((row): row is WatchdogTaskRow => row !== null);

  const budgetSpentUsd = rows(usageResult.data)
    .map((row) => num(row.cost_estimate_usd))
    .filter((value): value is number => value !== null)
    .reduce((total, value) => total + value, 0);

  return evaluateWatchdog({
    now: now(),
    tasks,
    budgetSpentUsd,
    thresholds: readWatchdogThresholds(environment),
  });
}

async function defaultDeps(): Promise<WatchdogRouteDeps> {
  const [{ getAuthenticatedUser }, { createSupabaseServerClient }, workspaces] =
    await Promise.all([
      import("../../../../../lib/auth.ts"),
      import("../../../../../lib/supabase/server.ts"),
      import("../../../../../lib/workspaces.ts"),
    ]);

  const environment = process.env;

  return {
    environment,
    now: () => new Date(),
    getAuthenticatedUser,
    async createClient() {
      const supabase = await createSupabaseServerClient();
      return (supabase as unknown as ObservabilityClient | null) ?? null;
    },
    getCurrentWorkspace(client) {
      return workspaces.getCurrentWorkspace(
        client as unknown as SupabaseClient,
      );
    },
    readReport(client, workspaceId) {
      return readWorkspaceReport(
        client,
        workspaceId,
        () => new Date(),
        environment,
      );
    },
  };
}

export async function GET(): Promise<Response> {
  return createWatchdogHandler(await defaultDeps())();
}
