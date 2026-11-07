import type { AgentEvent } from "./types.ts";

/**
 * SSE framing helpers for `GET /api/agent/tasks/[id]/events`.
 *
 * Event payloads are content-free runtime facts (ids, states, counts), and the
 * formatter keeps them on one `data:` line so no payload value can inject a
 * second SSE frame.
 */

export function parseLastEventId(value: string | null | undefined): number {
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return 0;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function formatSseEvent(event: AgentEvent): string {
  const data = JSON.stringify({
    id: event.id,
    task_id: event.taskId,
    seq: event.seq,
    type: event.type,
    payload: event.payload,
    created_at: event.createdAt,
  });
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${data}\n\n`;
}

export function formatSseRetry(milliseconds: number): string {
  const bounded = Math.min(60_000, Math.max(0, Math.floor(milliseconds)));
  return `retry: ${bounded}\n\n`;
}

export function formatSseComment(text: string): string {
  const sanitized = text.replace(/[\r\n]+/g, " ").slice(0, 200);
  return `: ${sanitized}\n\n`;
}

/** Sleeps for `ms`, or resolves immediately when the request is aborted. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(done, Math.max(0, ms));

    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }

    signal?.addEventListener("abort", done, { once: true });
  });
}
