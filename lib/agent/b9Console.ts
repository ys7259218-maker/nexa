/**
 * Phase B B9 controlled product integration (matrix B9-01 … B9-06).
 *
 * Content-free projections for the read-only agent console. Every value that
 * reaches a B9 page passes through here: arbitrary task text, event payloads and
 * evidence records are never returned. Functions are pure — no store, clock,
 * network or database access — so the same projection can be unit-tested offline.
 *
 * This file is additive. It does not modify the B1-B8 runtime, the draft/WA
 * pipeline, or any existing gate.
 */

import type { AgentEvent, AgentTask, AgentTaskSummary } from "./types.ts";

const SAFE_CODE = /^[a-z0-9_]{1,64}$/;

/**
 * Reduce arbitrary text to a lowercase safe code, or "other". The input is
 * never returned: a phone number, sentence, URL or JSON payload becomes one of
 * a fixed, bounded set of values. `null` for absent values keeps optional
 * fields optional rather than inventing a bucket for "nothing happened".
 */
export function toSafeB9Code(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return null;
  return SAFE_CODE.test(normalized) ? normalized : "other";
}

export type B9SafeCounts = Readonly<Record<string, number>>;

export type B9TaskDetail = Readonly<{
  id: string;
  state: AgentTask["state"];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deadlineAt: string;
  cancelRequested: boolean;
  errorClass: string | null;
  eventCount: number;
  eventTypes: B9SafeCounts;
}>;

function safeCounts(values: readonly string[]): B9SafeCounts {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const code = toSafeB9Code(value);
    if (code === null) continue;
    counts[code] = (counts[code] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

/**
 * Project one RLS-scoped task and its events into a content-free detail view.
 * The task text and every event payload are intentionally absent; only state,
 * timestamps, a safe error code and event-type counts survive.
 */
export function projectB9TaskDetail(
  task: AgentTask | null,
  events: readonly AgentEvent[],
): B9TaskDetail | null {
  if (task === null) return null;

  return Object.freeze({
    id: task.id,
    state: task.state,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    deadlineAt: task.deadlineAt,
    cancelRequested: task.cancelRequested,
    errorClass: toSafeB9Code(task.failureReason),
    eventCount: events.length,
    eventTypes: safeCounts(events.map((event) => event.type)),
  });
}

export type B9ApprovalRow = Readonly<{
  id: string;
  state: AgentTaskSummary["state"];
  createdAt: string;
  deadlineAt: string;
}>;

export type B9ApprovalQueue = Readonly<{
  total: number;
  rows: readonly B9ApprovalRow[];
}>;

/**
 * Project the in-flight approval queue from already-scoped task summaries.
 * Only the rows awaiting approval are kept, and no task text is copied.
 */
export function projectB9ApprovalQueue(
  tasks: readonly AgentTaskSummary[],
): B9ApprovalQueue {
  const rows: B9ApprovalRow[] = [];
  for (const task of tasks) {
    if (task.state !== "AWAITING_APPROVAL") continue;
    rows.push(
      Object.freeze({
        id: task.id,
        state: task.state,
        createdAt: task.createdAt,
        deadlineAt: task.deadlineAt,
      }),
    );
  }
  return Object.freeze({ total: rows.length, rows: Object.freeze(rows) });
}
