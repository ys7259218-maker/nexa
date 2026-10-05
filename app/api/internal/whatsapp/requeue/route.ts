import { getAIProvider } from "@/lib/server/aiProvider";
import { ledgerRowToEvent, processMessageEvent } from "@/lib/whatsappIngest";
import { createSupabaseServiceClient } from "@/lib/server/whatsappProcessor";

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WHATSAPP_RETRY_SECRET;
  if (!secret || secret.trim().length < 32) {
    return json({ error: "Requeue is not configured" }, 503);
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return json({ error: "Service role client unavailable" }, 503);
  }

  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("last_error", "unknown_channel")
    .in("status", ["skipped", "claimed", "failed"])
    .order("received_at", { ascending: true })
    .limit(60);

  if (error) {
    return json({ error: error.message }, 500);
  }

  const rows = (data ?? []) as Parameters<typeof ledgerRowToEvent>[0][];

  if (rows.length > 0) {
    const { error: resetError } = await supabase
      .from("webhook_events")
      .update({ status: "claimed", attempts: 0, last_error: "" })
      .in(
        "id",
        rows.map((row) => row.id),
      );

    if (resetError) {
      return json({ error: resetError.message }, 500);
    }
  }

  const summary = { accepted: 0, duplicates: 0, skipped: 0, failed: 0 };
  const details: Array<{ event_id: string; status: string; error?: string }> = [];

  for (const row of rows) {
    const event = ledgerRowToEvent(row);
    if (row.event_kind === "status") {
      summary.skipped += 1;
      details.push({ event_id: row.event_id, status: "skipped" });
      continue;
    }

    const outcome = await processMessageEvent(
      supabase,
      getAIProvider(),
      event.eventId,
      event as Exclude<typeof event, { eventKind: "status" }>,
      row.attempts,
    );
    if (outcome === "processed") summary.accepted += 1;
    else if (outcome === "skipped") summary.skipped += 1;
    else summary.failed += 1;
    details.push({ event_id: row.event_id, status: outcome });
  }

  return json({ ok: true, reprocessed: rows.length, summary, details }, 200);
}