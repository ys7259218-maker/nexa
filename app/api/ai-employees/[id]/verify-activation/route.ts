import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAIEmployee } from "@/lib/aiEmployees";
import { listWhatsAppChannels } from "@/lib/whatsappChannels";
import { createSupabaseServiceClient } from "@/lib/server/whatsappProcessor";
import {
  verifyActivationEvidence,
  type EvidenceWriter,
  type StoredActivationEvidence,
} from "@/lib/server/activationEvidence";

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return json({ error: "unauthenticated" }, 401);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json({ error: "verifier-unavailable" }, 503);

  const employeeResult = await getAIEmployee(supabase, id);
  if (!employeeResult.data) return json({ error: "not-found" }, 404);

  const employee = employeeResult.data;
  const workspaceId = employee.workspace_id;
  if (!workspaceId) return json({ error: "invalid-target" }, 400);

  const whatsappChannelAssignmentEnabled =
    process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED === "true";

  let channelLinked = false;
  if (whatsappChannelAssignmentEnabled) {
    const channelResult = await listWhatsAppChannels(supabase, 10, true);
    channelLinked = channelResult.data.some(
      (channel) => channel.ai_employee_id === employee.id,
    );
  }

  // Every check below is evaluated on the server from environment and
  // database state. The request body is deliberately ignored so no
  // client-supplied readiness boolean can influence the evidence.
  const webhookConfigured = Boolean(
    process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET,
  );
  const inboundReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const outboundEnabled = process.env.WHATSAPP_OUTBOUND_ENABLED === "true";

  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) return json({ error: "verifier-unavailable" }, 503);

  const writer: EvidenceWriter = {
    async readEvidence(employeeId) {
      const { data, error } = await serviceClient
        .from("ai_employee_activation_evidence")
        .select(
          "ai_employee_id, workspace_id, channel_linked, webhook_configured, inbound_ready, outbound_enabled, verified_at, verified_by",
        )
        .eq("ai_employee_id", employeeId)
        .maybeSingle();
      return {
        row: (data as StoredActivationEvidence | null) ?? null,
        error: error?.message ?? null,
      };
    },
    async writeEvidence(row) {
      const { error } = await serviceClient
        .from("ai_employee_activation_evidence")
        .upsert(row, { onConflict: "ai_employee_id" });
      return { error: error?.message ?? null };
    },
  };

  const response = await verifyActivationEvidence({
    actor: { id: user.id },
    employeeId: employee.id,
    employee,
    workspaceId,
    channel: { linked: channelLinked, webhookConfigured, inboundReady, outboundEnabled },
    verifiedBy: user.id,
    writer,
  });

  if (!response.ok) {
    const status =
      response.error === "unauthenticated" ? 401 : response.error === "invalid-target" ? 400 : response.error === "not-found" ? 404 : response.error === "verifier-unavailable" ? 503 : 403;
    return json({ error: response.error }, status);
  }

  return json({ ok: true, verified: response.result }, 200);
}