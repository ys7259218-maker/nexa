import {
  abortableSleep,
  formatSseComment,
  formatSseEvent,
  formatSseRetry,
  parseLastEventId,
} from "@/lib/agent/events";
import { inspectAgentRuntimeGate } from "@/lib/agent/gate";
import {
  getVisibleAgentTask,
  isAgentTaskId,
  listVisibleAgentEvents,
} from "@/lib/agent/queries";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * B1 SSE skeleton. It streams durable `agent_events` rows for one visible task
 * and closes after a bounded window; it is not a pub/sub replacement.
 *
 * Fail-closed rules:
 * - feature gate off (or production) => 404;
 * - unauthenticated => 401;
 * - malformed id, missing client, or task not visible through the caller's
 *   RLS-scoped client => 404, never a cross-workspace existence signal.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 1_000;
const MAX_STREAM_MS = 30_000;
const MAX_EVENTS_PER_POLL = 100;

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = inspectAgentRuntimeGate(process.env);
  if (!gate.enabled) return notFound();

  const user = await getAuthenticatedUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;
  if (!isAgentTaskId(id)) return notFound();

  const supabase = await createSupabaseServerClient();
  if (!supabase) return notFound();

  const task = await getVisibleAgentTask(supabase, id);
  if (!task) return notFound();

  const url = new URL(request.url);
  let cursor = Math.max(
    parseLastEventId(request.headers.get("last-event-id")),
    parseLastEventId(url.searchParams.get("after")),
  );

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The consumer already cancelled; there is nothing left to close.
        }
      };

      const onAbort = () => close();
      request.signal.addEventListener("abort", onAbort);

      send(formatSseRetry(3_000));
      send(formatSseComment("agent runtime events"));

      const deadline = Date.now() + MAX_STREAM_MS;

      try {
        while (!closed && Date.now() < deadline) {
          const events = await listVisibleAgentEvents(
            supabase,
            id,
            cursor,
            MAX_EVENTS_PER_POLL,
          );

          if (events.length === 0) {
            send(formatSseComment("keep-alive"));
          } else {
            for (const event of events) {
              send(formatSseEvent(event));
              cursor = event.seq;
            }
          }

          await abortableSleep(POLL_INTERVAL_MS, request.signal);
        }

        if (!closed) send(formatSseComment("stream window complete"));
      } catch {
        // Fail closed: a read error ends the stream without inventing events.
      } finally {
        request.signal.removeEventListener("abort", onAbort);
        close();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
