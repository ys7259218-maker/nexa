import { createSupabaseServiceClient } from "@/lib/server/whatsappProcessor";

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Type": "no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.WHATSAPP_RETRY_SECRET;
  if (!secret || secret.trim().length < 32) {
    return json({ error: "Diagnostics are not configured" }, 503);
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
    .select("event_id, event_kind, phone_number_id, from_wa_id, profile_name, message_type, message_body, status, attempts, last_error, received_at")
    .order("received_at", { ascending: false })
    .limit(15);

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, events: data }, 200);
}