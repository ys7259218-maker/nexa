import Link from "next/link";

import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import GeneralSettings from "@/components/ai/GeneralSettings";
import VoiceSettings from "@/components/ai/VoiceSettings";
import KnowledgeBase from "@/components/ai/KnowledgeBase";
import PhoneSetup from "@/components/ai/PhoneSetup";
import WhatsAppSetup from "@/components/ai/WhatsAppSetup";
import DeployAI from "@/components/ai/DeployAI";
import AuditTrail from "@/components/ai/AuditTrail";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAIEmployee, type AIEmployee } from "@/lib/aiEmployees";
import {
  listWhatsAppChannels,
  type WhatsAppChannel,
} from "@/lib/whatsappChannels";
import { listEmployeeAuditEvents, type AuditEvent } from "@/lib/auditEvents";

export default async function AIEmployeeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser();

  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  let loadError: string | null = null;
  let employee: AIEmployee | null = null;
  let channels: WhatsAppChannel[] = [];
  let auditEvents: AuditEvent[] = [];

  const whatsappWebhookConfigured = Boolean(
    process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET,
  );
  const whatsappInboundReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const whatsappOutboundEnabled = process.env.WHATSAPP_OUTBOUND_ENABLED === "true";
  const employeeLifecycleEnabled = process.env.EMPLOYEE_LIFECYCLE_ENABLED === "true";
  const auditLogEnabled = process.env.AUDIT_LOG_ENABLED === "true";
  const versionHistoryEnabled = process.env.EMPLOYEE_VERSION_HISTORY_ENABLED === "true";
  const knowledgeV0Enabled = process.env.KNOWLEDGE_V0_ENABLED === "true";
  const whatsappChannelAssignmentEnabled =
    process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED === "true";

  if (!supabase) {
    loadError =
      "Supabase is not configured. Add the variables from .env.example to manage AI employees.";
  } else {
    const result = await getAIEmployee(supabase, id);
    const channelResult = await listWhatsAppChannels(
      supabase,
      10,
      whatsappChannelAssignmentEnabled,
    );

    if (result.error) {
      loadError = result.error;
    } else {
      employee = result.data;
    }

    if (!channelResult.error) {
      channels = channelResult.data;
    }

    if (auditLogEnabled) {
      const auditResult = await listEmployeeAuditEvents(supabase, id);
      if (!auditResult.error) auditEvents = auditResult.data;
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              {employee ? employee.name : "AI Employee"}
            </h1>

            <p className="text-zinc-400 mt-2">
              Configure saved employee metadata and the integrations currently available.
            </p>
          </div>

          {employee ? (
            <div className="flex flex-wrap gap-3">
              {knowledgeV0Enabled ? (
                <Link
                  href={`/ai-employees/${employee.id}/knowledge`}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-semibold text-white transition hover:bg-zinc-800"
                >
                  Structured knowledge
                </Link>
              ) : null}
              {versionHistoryEnabled ? (
                <Link
                  href={`/ai-employees/${employee.id}/versions`}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-semibold text-white transition hover:bg-zinc-800"
                >
                  Version history
                </Link>
              ) : null}
              <Link
                href={`/ai-employees/${employee.id}/test`}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white"
              >
                Open safe test sandbox
              </Link>
            </div>
          ) : null}
        </div>

        {loadError || !employee ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-400">
              {loadError ? "Could not load this AI Employee" : "AI Employee not found"}
            </h2>

            <p className="text-zinc-400">
              {loadError
                ? loadError
                : "It may have been deleted, or it does not belong to your account."}
            </p>

            <div className="pt-1">
              <Link
                href="/ai-employees"
                className="inline-flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium px-5 py-3 rounded-xl transition"
              >
                Back to AI Employees
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <GeneralSettings employee={employee} />

            <VoiceSettings employee={employee} />

            <KnowledgeBase employee={employee} />

            <PhoneSetup employee={employee} />

            <WhatsAppSetup
              employeeId={employee.id}
              assignmentEnabled={whatsappChannelAssignmentEnabled}
              webhookConfigured={whatsappWebhookConfigured}
              inboundReady={whatsappInboundReady}
              channels={channels}
            />

            <DeployAI employee={employee} channelLinked={whatsappChannelAssignmentEnabled && channels.some((channel) => channel.ai_employee_id === employee.id)} webhookConfigured={whatsappWebhookConfigured} inboundReady={whatsappInboundReady} outboundEnabled={whatsappOutboundEnabled} lifecycleEnabled={employeeLifecycleEnabled} />

            {auditLogEnabled ? <AuditTrail events={auditEvents} /> : null}
          </>
        )}

      </div>
    </AppLayout>
  );
}
