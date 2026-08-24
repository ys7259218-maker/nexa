import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import TeamMemberRole from "@/components/team/TeamMemberRole";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspaces";
import { listTeamMembers, maskMemberId } from "@/lib/teamMembers";

export default async function TeamSettingsPage() {
  await requireAuthenticatedUser();
  const enabled = process.env.TEAM_MANAGEMENT_ENABLED === "true";
  const client = await createSupabaseServerClient();
  if (!enabled || !client) return <AppLayout><Card><h1 className="text-2xl font-bold">Team settings</h1><p className="mt-2 text-amber-300">Team management is safely unavailable until its database migration is verified.</p></Card></AppLayout>;
  const workspaceResult = await getCurrentWorkspace(client);
  if (!workspaceResult.data) return <AppLayout><Card><p className="text-red-300">{workspaceResult.error}</p></Card></AppLayout>;
  const members = await listTeamMembers(client, workspaceResult.data.id);
  return <AppLayout><div className="space-y-6"><div><h1 className="text-4xl font-bold">Team settings</h1><p className="mt-2 text-zinc-400">{workspaceResult.data.name} · role-based access</p></div><Card className="space-y-4">
    {members.error ? <p className="text-red-300">{members.error}</p> : members.data.map((member) => <div key={member.user_id} className="flex items-center justify-between border-b border-zinc-800 pb-3 last:border-0"><div><p className="font-medium">Member {maskMemberId(member.user_id)}</p><p className="text-sm text-zinc-500">Joined {new Date(member.created_at).toLocaleDateString()}</p></div><TeamMemberRole workspaceId={workspaceResult.data!.id} userId={member.user_id} role={member.role} viewerRole={workspaceResult.data!.role} /></div>)}
  </Card><p className="text-sm text-zinc-500">Invitations are intentionally not enabled yet; role enforcement is being verified first.</p></div></AppLayout>;
}
