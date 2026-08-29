import Link from "next/link";

import KnowledgeSourceRegistry from "@/components/ai/KnowledgeSourceRegistry";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getAIEmployee, type AIEmployee } from "@/lib/aiEmployees";
import { isValidKnowledgeSourceId, listKnowledgeSourceDeletionReceipts, listKnowledgeSources, type KnowledgeSource, type KnowledgeSourceDeletionReceipt } from "@/lib/knowledgeSources";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function KnowledgeSourcesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuthenticatedUser();
  const { id } = await params;
  const enabled = process.env.KNOWLEDGE_SOURCE_REGISTRY_ENABLED === "true";
  let employee: AIEmployee | null = null;
  let sources: KnowledgeSource[] = [];
  let receipts: KnowledgeSourceDeletionReceipt[] = [];
  let error: string | null = null;

  if (!enabled) error = "Knowledge Source Registry v1.1 is safely disabled until its migrations and dedicated role/RLS checks pass.";
  else if (!isValidKnowledgeSourceId(id)) error = "This AI Employee could not be found.";
  else {
    const supabase = await createSupabaseServerClient();
    if (!supabase) error = "The source registry is unavailable because the app data connection is not configured.";
    else {
      const employeeResult = await getAIEmployee(supabase, id);
      if (employeeResult.error || !employeeResult.data) error = "This AI Employee could not be found or does not belong to your workspace.";
      else {
        employee = employeeResult.data;
        const [sourceResult, receiptResult] = await Promise.all([
          listKnowledgeSources(supabase, id),
          listKnowledgeSourceDeletionReceipts(supabase, id),
        ]);
        if (sourceResult.error) error = sourceResult.error;
        else if (receiptResult.error) error = receiptResult.error;
        else {
          sources = sourceResult.data;
          receipts = receiptResult.data;
        }
      }
    }
  }

  return <AppLayout><div className="space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Source Registry v1.1</p><h1 className="mt-2 text-4xl font-bold">{employee ? `${employee.name} source references` : "Knowledge source references"}</h1><p className="mt-2 max-w-2xl text-zinc-400">A removable registry of source metadata. Registration does not activate ingestion or AI use.</p></div>
      <Link href={`/ai-employees/${id}/knowledge`} className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-medium text-white">Back to structured knowledge</Link>
    </div>
    {error ? <Card className="space-y-3"><h2 className="text-xl font-semibold text-amber-300">Source registry unavailable</h2><p className="text-zinc-400">{error}</p></Card> : employee ? <KnowledgeSourceRegistry employeeId={employee.id} initialSources={sources} initialReceipts={receipts} /> : null}
  </div></AppLayout>;
}
