import { isValidInternalBearer } from "@/lib/internalAuth.ts";
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
    return json({ error: "Bootstrap service is not configured" }, 503);
  }

  if (!isValidInternalBearer(request.headers.get("authorization"), secret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return json({ error: "Service role client unavailable" }, 503);
  }

  let payload: { phoneNumberId?: unknown; displayName?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const phoneNumberId = typeof payload.phoneNumberId === "string" ? payload.phoneNumberId.trim() : "";
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";

  if (!phoneNumberId) {
    return json({ error: "phoneNumberId is required" }, 400);
  }

  if (phoneNumberId.length > 200 || displayName.length > 200) {
    return json({ error: "Value exceeds maximum length" }, 400);
  }

  const { data, error } = await supabase
    .from("whatsapp_channels")
    .upsert(
      { phone_number_id: phoneNumberId, display_name: displayName || null },
      { onConflict: "phone_number_id", ignoreDuplicates: false },
    )
    .select("id, phone_number_id, display_name, user_id, workspace_id, ai_employee_id, created_at");

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, channel: data }, 200);
}