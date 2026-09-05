import type { Metadata } from "next";
import Link from "next/link";

import StructuredKnowledgeManager from "@/components/ai/StructuredKnowledgeManager";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getAIEmployee, type AIEmployee } from "@/lib/aiEmployees";
import { isValidKnowledgeId, listKnowledgeEntries, type KnowledgeEntry } from "@/lib/knowledgeEntries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Knowledge | Nexa AI" };

export default async function EmployeeKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser();

  const { id } = await params;
  const enabled = process.env.KNOWLEDGE_V0_ENABLED === "true";
  const supabase = await createSupabaseServerClient();
  let employee: AIEmployee | null = null;
  let entries: KnowledgeEntry[] = [];
  let error: string | null = null;

  if (!enabled) {
    error = "Structured Knowledge v0 is safely disabled until its migration and RLS checks pass.";
  } else if (!supabase) {
    error = "Structured knowledge is unavailable because the app data connection is not configured.";
  } else if (!isValidKnowledgeId(id)) {
    error = "This AI Employee could not be found.";
  } else {
    const employeeResult = await getAIEmployee(supabase, id);
    if (employeeResult.error || !employeeResult.data) {
      error = "This AI Employee could not be found or does not belong to your workspace.";
    } else {
      employee = employeeResult.data;
      const knowledgeResult = await listKnowledgeEntries(supabase, id);
      if (knowledgeResult.error) error = knowledgeResult.error;
      else entries = knowledgeResult.data;
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Knowledge v0</p>
            <h1 className="mt-2 text-4xl font-bold">
              {employee ? `${employee.name} knowledge` : "AI Employee knowledge"}
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-400">
              Structured, editable, deletable FAQs and notes. Drafts stay excluded until you mark them verified.
            </p>
          </div>
          <Link
            href={`/ai-employees/${id}`}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-800"
          >
            Back to management
          </Link>
        </div>

        {error ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-amber-300">Structured knowledge unavailable</h2>
            <p className="text-zinc-400">{error}</p>
          </Card>
        ) : employee ? (
          <StructuredKnowledgeManager employeeId={employee.id} initialEntries={entries} />
        ) : null}
      </div>
    </AppLayout>
  );
}
