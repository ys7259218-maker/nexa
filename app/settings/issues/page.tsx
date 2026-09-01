import AppLayout from "@/components/layout/AppLayout";
import IssueReportingPanel from "@/components/issues/IssueReportingPanel";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { listIssueReports } from "@/lib/issueReports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspaces";

export default async function IssueReportingPage() {
  await requireAuthenticatedUser();
  if (process.env.ISSUE_REPORTING_ENABLED !== "true") return <AppLayout><Card className="space-y-3"><h1 className="text-2xl font-bold">Issue reporting</h1><p className="text-amber-300">Issue reporting is safely unavailable until its migration and dedicated role/RLS checks pass.</p></Card></AppLayout>;
  const client = await createSupabaseServerClient();
  if (!client) return <AppLayout><Card><h1 className="text-2xl font-bold">Issue reporting unavailable</h1><p className="mt-2 text-red-300">The workspace data connection is not configured.</p></Card></AppLayout>;
  const workspace = await getCurrentWorkspace(client);
  if (!workspace.data) return <AppLayout><Card><h1 className="text-2xl font-bold">Issue reporting unavailable</h1><p className="mt-2 text-red-300">{workspace.error}</p></Card></AppLayout>;
  const reports = await listIssueReports(client, workspace.data.id);
  return <AppLayout><div className="space-y-8"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Closed beta · private workspace</p><h1 className="mt-2 text-4xl font-bold">Issue reporting</h1><p className="mt-2 max-w-3xl text-zinc-400">Report a product issue without automatic diagnostics or hidden data collection.</p></div>{reports.error ? <Card className="space-y-3"><h2 className="text-xl font-semibold text-red-300">Reports could not be loaded</h2><p className="text-zinc-400">{reports.error}</p></Card> : <IssueReportingPanel workspaceId={workspace.data.id} initialReports={reports.data} />}<p className="text-sm text-zinc-500">Current limitation: reports have no self-service deletion or automatic retention expiry. They remain in the workspace database until a separately reviewed deletion workflow or operator process removes them.</p></div></AppLayout>;
}
