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

  let payload: { phoneNumberId?: unknown; displayName?: unknown; employeeId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const phoneNumberId = typeof payload.phoneNumberId === "string" ? payload.phoneNumberId.trim() : "";
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const employeeId = typeof payload.employeeId === "string" ? payload.employeeId.trim() : "";

  if (!phoneNumberId) {
    return json({ error: "phoneNumberId is required" }, 400);
  }

  if (phoneNumberId.length > 200 || displayName.length > 200 || employeeId.length > 200) {
    return json({ error: "Value exceeds maximum length" }, 400);
  }

  let ownerQuery = supabase.from("ai_employees").select("user_id, workspace_id").limit(1);
  if (employeeId) {
    ownerQuery = ownerQuery.eq("id", employeeId);
  }

  const { data: ownerRows, error: ownerError } = await ownerQuery;
  if (ownerError) {
    return json({ error: ownerError.message }, 500);
  }

  const owner = (ownerRows ?? [])[0] as { user_id?: string; workspace_id?: string } | undefined;
  if (!owner?.user_id || !owner?.workspace_id) {
    return json({ error: "No AI Employee owner could be resolved for this channel" }, 404);
  }

  const row = {
    phone_number_id: phoneNumberId,
    display_name: displayName || null,
    user_id: owner.user_id,
    workspace_id: owner.workspace_id,
    ...(employeeId ? { ai_employee_id: employeeId } : {}),
  };

  const { data, error } = await supabase
    .from("whatsapp_channels")
    .upsert(row, { onConflict: "phone_number_id", ignoreDuplicates: false })
    .select("id, phone_number_id, display_name, user_id, workspace_id, ai_employee_id, created_at");

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, channel: data }, 200);
}