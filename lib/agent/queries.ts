import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapAgentEventRow,
  mapAgentTaskRow,
  type AgentEventRow,
  type AgentTaskRow,
} from "./rows.ts";
import type { AgentEvent, AgentTask, AgentTaskSummary } from "./types.ts";

/**
 * RLS-scoped reads used by the read-only console and the SSE route. Callers
 * pass the authenticated Supabase server client, so workspace membership is
 * enforced by the select policies in `20261108010000_agent_runtime_b1.sql`.
 * Every failure returns an empty result instead of surfacing an error page or
 * leaking cross-workspace existence.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAgentTaskId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function toAgentTaskSummary(task: AgentTask): AgentTaskSummary {
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
  };
}

export async function listVisibleAgentTasks(
  supabase: SupabaseClient,
  limit = 25,
): Promise<AgentTaskSummary[]> {
  const bounded = Math.min(100, Math.max(1, Math.floor(limit)));
  const result = await supabase
    .from("agent_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(bounded);

  if (result.error || !Array.isArray(result.data)) return [];

  return result.data
    .map((row) => mapAgentTaskRow(row as AgentTaskRow))
    .filter((task): task is AgentTask => task !== null)
    .map(toAgentTaskSummary);
}

export async function getVisibleAgentTask(
  supabase: SupabaseClient,
  taskId: string,
): Promise<AgentTask | null> {
  if (!isAgentTaskId(taskId)) return null;

  const result = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (result.error) return null;
  return mapAgentTaskRow(result.data as AgentTaskRow | null);
}

export async function listVisibleAgentEvents(
  supabase: SupabaseClient,
  taskId: string,
  afterSeq: number,
  limit = 100,
): Promise<AgentEvent[]> {
  if (!isAgentTaskId(taskId)) return [];

  const bounded = Math.min(200, Math.max(1, Math.floor(limit)));
  const cursor = Number.isSafeInteger(afterSeq) && afterSeq > 0 ? afterSeq : 0;
  const result = await supabase
    .from("agent_events")
    .select("*")
    .eq("task_id", taskId)
    .gt("seq", cursor)
    .order("seq", { ascending: true })
    .limit(bounded);

  if (result.error || !Array.isArray(result.data)) return [];

  return result.data
    .map((row) => mapAgentEventRow(row as AgentEventRow))
    .filter((event): event is AgentEvent => event !== null);
}
