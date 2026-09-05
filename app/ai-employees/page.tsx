import type { Metadata } from "next";
import Link from "next/link";

import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import AIEmployeeList from "@/components/ai/AIEmployeeList";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAIEmployees, type AIEmployee } from "@/lib/aiEmployees";
import { buildActivationChecklist } from "@/lib/employeeActivation";
import { listWhatsAppChannels } from "@/lib/whatsappChannels";

function CreateEmployeeLink() {
  return (
    <Link
      href="/dashboard/ai-employees/new"
      className="inline-flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-3 rounded-xl transition"
    >
      Create your first AI Employee
    </Link>
  );
}

export const metadata: Metadata = { title: "AI Employees | Nexa AI" };

export default async function AIEmployeesPage() {
  const user = await requireAuthenticatedUser();

  const supabase = await createSupabaseServerClient();

  let error: string | null = null;
  let employees: AIEmployee[] = [];
  const channelLinkedById: Record<string, boolean> = {};
  const readinessById: Record<string, number> = {};
  const readinessTotal = buildActivationChecklist(
    {
      name: "",
      business_name: "",
      department: "",
      business_description: "",
      greeting_message: "",
      timezone: "",
      working_hours: "",
      language: "",
      voice: "",
      knowledge_website: "",
      knowledge_faq_document: "",
      knowledge_pdf_url: "",
      knowledge_notes: "",
    } as AIEmployee,
    {
      linked: false,
      webhookConfigured: false,
      inboundReady: false,
      outboundEnabled: false,
    },
  ).length;

  if (!supabase) {
    error =
      "Supabase is not configured. Add the variables from .env.example to load your AI employees.";
  } else {
    const result = await listAIEmployees(supabase);
    const whatsappChannelAssignmentEnabled =
      process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED === "true";
    const whatsappWebhookConfigured = Boolean(
      process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET,
    );
    const whatsappInboundReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const whatsappOutboundEnabled = process.env.WHATSAPP_OUTBOUND_ENABLED === "true";
    const channelResult = await listWhatsAppChannels(
      supabase,
      50,
      whatsappChannelAssignmentEnabled,
    );

    if (result.error) {
      error = result.error;
    } else {
      employees = result.data ?? [];
    }

    if (!channelResult.error) {
      for (const channel of channelResult.data) {
        if (channel.ai_employee_id) {
          channelLinkedById[channel.ai_employee_id] = true;
        }
      }
    }

    if (!result.error) {
      for (const employee of employees) {
        const checks = buildActivationChecklist(employee, {
          linked: channelLinkedById[employee.id] ?? false,
          webhookConfigured: whatsappWebhookConfigured,
          inboundReady: whatsappInboundReady,
          outboundEnabled: whatsappOutboundEnabled,
        });
        readinessById[employee.id] = checks.filter((check) => check.ready).length;
      }
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold">
              AI Employees
            </h1>

            <p className="text-zinc-400 mt-2">
              Welcome back {user.email}. Create, manage and monitor your AI workforce.
            </p>
          </div>

          {!error && (
            <CreateEmployeeLink />
          )}
        </div>

        {error ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-400">
              Could not load your AI employees
            </h2>

            <p className="text-zinc-400">
              {error}
            </p>

            <p className="text-zinc-500 text-sm">
              Fix the issue and reload this page to try again.
            </p>
          </Card>
        ) : employees.length === 0 ? (
          <Card className="space-y-4">
            <h2 className="text-2xl font-bold">
              No AI employees yet
            </h2>

            <p className="text-zinc-400">
              Your workforce is empty. Create a record, then configure only the channels that pass their readiness checks.
            </p>

            <div className="pt-1">
              <CreateEmployeeLink />
            </div>
          </Card>
        ) : (
          <AIEmployeeList
            employees={employees}
            channelLinkedById={channelLinkedById}
            readinessById={readinessById}
            readinessTotal={readinessTotal}
          />
        )}
      </div>
    </AppLayout>
  );
}
