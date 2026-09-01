import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import IssueReportForm from "@/components/issues/IssueReportForm";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspaces";

export default async function ReportIssuePage() {
  await requireAuthenticatedUser();
  const enabled = process.env.ISSUE_REPORTING_ENABLED === "true";
  const client = await createSupabaseServerClient();
  if (!enabled || !client) return <AppLayout><Card><h1 className="text-2xl font-bold">Report an issue</h1><p className="mt-2 text-amber-300">Issue reporting is safely unavailable until its migration and workspace-access checks are verified.</p></Card></AppLayout>;
  const workspace = await getCurrentWorkspace(client);
  if (!workspace.data) return <AppLayout><Card><h1 className="text-2xl font-bold">Report an issue</h1><p className="mt-2 text-red-300">{workspace.error}</p></Card></AppLayout>;
  return <AppLayout><div className="mx-auto max-w-3xl space-y-6"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Private workspace feedback</p><h1 className="mt-2 text-4xl font-bold">Report an issue</h1><p className="mt-2 text-zinc-400">Submit a bounded report visible only to you and workspace Owners/Admins.</p></div><Card><IssueReportForm workspaceId={workspace.data.id} /></Card><p className="text-sm text-zinc-500">Reports currently remain until an approved retention/deletion workflow is implemented. Submission does not contact an external support provider or send a message.</p></div></AppLayout>;
}
