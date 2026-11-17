import { inspectAgentObservabilityGate } from "../../../../../lib/agent/observability/gate.ts";
import { computeObservabilitySummary } from "../../../../../lib/agent/observability/metrics.ts";
import type {
  ObservabilityAuditRow,
  ObservabilitySummary,
  ObservabilityTaskRow,
  ObservabilityUsageRow,
} from "../../../../../lib/agent/observability/types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * B8 read-only observability summary (scope C5, matrix OB-01 … OB-08).
 *
 * Fail-closed rules:
 * - either flag off, or production => 404 with no store read;
 * - unauthenticated => 401;
 * - no RLS-visible workspace => 404 with the same uniform body;
 * - store read error => 503 with a typed body and no fabricated numbers.
 *
 * The response is content-free: counts, durations, statuses and tiers only.
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

export type SummaryRouteDeps = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  getAuthenticatedUser: () => Promise<Readonly<{ id: string }> | null>;
  createClient: () => Promise<ObservabilityClient | null>;
  getCurrentWorkspace: (
    client: ObservabilityClient,
  ) => Promise<WorkspaceLookup>;
  readSummary: (
    client: ObservabilityClient,
    workspaceId: string,
  ) => Promise<ObservabilitySummary>;
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

function ok(body: ObservabilitySummary): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export function createSummaryHandler(
  deps: SummaryRouteDeps,
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
      const summary = await deps.readSummary(client, workspace.data.id);
      return ok(summary);
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

function durationMs(row: Row): number | null {
  const created = Date.parse(text(row.created_at) ?? "");
  const completed = Date.parse(text(row.completed_at) ?? "");
  if (!Number.isFinite(created) || !Number.isFinite(completed)) return null;
  return Math.max(0, completed - created);
}

const TIER_ORDER = ["T0", "T1", "T2", "T3", "T4", "T5"] as const;

function highestTier(rowsIn: readonly Row[]): Map<string, string> {
  const byTask = new Map<string, string>();
  for (const row of rowsIn) {
    const declared = text(row.declared_tier);
    const plan = row.plan;
    const planRow = Array.isArray(plan) ? plan[0] : plan;
    const taskId =
      typeof planRow === "object" && planRow !== null
        ? text((planRow as Row).task_id)
        : null;
    if (declared === null || taskId === null) continue;

    const current = byTask.get(taskId);
    const currentRank = current
      ? (TIER_ORDER as readonly string[]).indexOf(current)
      : -1;
    const nextRank = (TIER_ORDER as readonly string[]).indexOf(declared);
    if (nextRank > currentRank) byTask.set(taskId, declared);
  }
  return byTask;
}

export async function readWorkspaceSummary(
  client: ObservabilityClient,
  workspaceId: string,
): Promise<ObservabilitySummary> {
  const tasksResult = await client
    .from("agent_tasks")
    .select("id,state,failure_reason,created_at,completed_at")
    .eq("workspace_id", workspaceId);
  if (tasksResult.error) throw new Error("summary_read_failed");

  const auditsResult = await client
    .from("agent_tool_invocations")
    .select("status,error_class,duration_ms")
    .eq("workspace_id", workspaceId);
  if (auditsResult.error) throw new Error("summary_read_failed");

  const usageResult = await client
    .from("agent_usage_ledger")
    .select("cost_estimate_usd")
    .eq("workspace_id", workspaceId);
  if (usageResult.error) throw new Error("summary_read_failed");

  const tierResult = await client
    .from("agent_plan_steps")
    .select("declared_tier,plan:agent_plans!inner(task_id)")
    .eq("workspace_id", workspaceId);
  const tiers = tierResult.error ? new Map<string, string>() : highestTier(rows(tierResult.data));

  const tasks: ObservabilityTaskRow[] = rows(tasksResult.data).map((row) => {
    const id = text(row.id);
    return {
      state: text(row.state) ?? "unknown_state",
      failureReason: text(row.failure_reason),
      tier: id !== null ? (tiers.get(id) ?? null) : null,
      durationMs: durationMs(row),
    };
  });

  const audits: ObservabilityAuditRow[] = rows(auditsResult.data)
    .map((row) => {
      const status = text(row.status);
      const duration = num(row.duration_ms);
      if (status !== "SUCCEEDED" && status !== "FAILED") return null;
      if (duration === null) return null;
      return {
        status,
        errorClass: text(row.error_class),
        durationMs: Math.max(0, duration),
      } satisfies ObservabilityAuditRow;
    })
    .filter((row): row is ObservabilityAuditRow => row !== null);

  const usage: ObservabilityUsageRow[] = rows(usageResult.data)
    .map((row) => num(row.cost_estimate_usd))
    .filter((value): value is number => value !== null)
    .map((costEstimateUsd) => ({ costEstimateUsd }));

  return computeObservabilitySummary({
    tasks,
    audits,
    usage,
    // C0a: OD-B7 is pending, so no ceiling is invented or read from a flag.
    budgetCeilingUsd: null,
    // C0a: OD-B5 is pending, so retention stays unconfigured.
    retentionConfigured: false,
  });
}

async function defaultDeps(): Promise<SummaryRouteDeps> {
  const [{ getAuthenticatedUser }, { createSupabaseServerClient }, workspaces] =
    await Promise.all([
      import("../../../../../lib/auth.ts"),
      import("../../../../../lib/supabase/server.ts"),
      import("../../../../../lib/workspaces.ts"),
    ]);

  return {
    environment: process.env,
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
    readSummary: readWorkspaceSummary,
  };
}

export async function GET(): Promise<Response> {
  return createSummaryHandler(await defaultDeps())();
}
