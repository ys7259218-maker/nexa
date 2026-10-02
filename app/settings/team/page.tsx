import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import TeamMemberRole from "@/components/team/TeamMemberRole";
import GoogleCalendarConnection from "@/components/calendar/GoogleCalendarConnection";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canEnableGoogleCalendar } from "@/lib/calendar/googleCalendarGate";
import { readCalendarConnectionStatus } from "@/lib/server/googleCalendarStore";
import { getCurrentWorkspace } from "@/lib/workspaces";
import { listTeamMembers, maskMemberId } from "@/lib/teamMembers";

export const metadata: Metadata = { title: "Team Settings | Nexa AI" };

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ calendar?: string }>;
}) {
  const params = (await searchParams) ?? {};
  await requireAuthenticatedUser();
  const enabled = process.env.TEAM_MANAGEMENT_ENABLED === "true";
  const client = await createSupabaseServerClient();
  if (!enabled || !client) return <AppLayout><Card><h1 className="text-2xl font-bold">Team settings</h1><p className="mt-2 text-amber-300">Team management is safely unavailable until its database migration is verified.</p></Card></AppLayout>;
  const workspaceResult = await getCurrentWorkspace(client);
  if (!workspaceResult.data) return <AppLayout><Card><p className="text-red-300">{workspaceResult.error}</p></Card></AppLayout>;
  const members = await listTeamMembers(client, workspaceResult.data.id);
  const calendarGate = canEnableGoogleCalendar({
    GOOGLE_CALENDAR_STAGING_ENABLED: process.env.GOOGLE_CALENDAR_STAGING_ENABLED,
    GOOGLE_CALENDAR_PRODUCTION_ENABLED: process.env.GOOGLE_CALENDAR_PRODUCTION_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
  const calendarStatus = calendarGate
    ? await readCalendarConnectionStatus(client, workspaceResult.data.id)
    : null;
  const status = calendarStatus?.ok ? calendarStatus.status : null;
  return <AppLayout><div className="space-y-6"><div><h1 className="text-4xl font-bold">Team settings</h1><p className="mt-2 text-zinc-400">{workspaceResult.data.name} · role-based access</p></div>
    {params.calendar === "connected" && <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Google Calendar connected.</p>}
    {params.calendar === "error" && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Calendar connection failed. Check the deployment logs for the gcal-diag branch and try again.</p>}
    {calendarStatus && status && status.connected && (
      <GoogleCalendarConnection
        workspaceId={workspaceResult.data.id}
        connected
        provider={status.provider}
        calendarId={status.calendarId}
        scopes={status.scopes}
        tokenExpiresAt={status.tokenExpiresAt}
        connectedAt={status.connectedAt}
      />
    )}
    {calendarStatus && status && !status.connected && (
      <GoogleCalendarConnection
        workspaceId={workspaceResult.data.id}
        connected={false}
        provider={null}
        calendarId={null}
        scopes={null}
        tokenExpiresAt={null}
        connectedAt={null}
      />
    )}
  <Card className="space-y-4">
    {members.error ? <p className="text-red-300">{members.error}</p> : members.data.map((member) => <div key={member.user_id} className="flex items-center justify-between border-b border-zinc-800 pb-3 last:border-0"><div><p className="font-medium">Member {maskMemberId(member.user_id)}</p><p className="text-sm text-zinc-500">Joined <time dateTime={member.created_at}>{new Date(member.created_at).toLocaleDateString()}</time></p></div><TeamMemberRole workspaceId={workspaceResult.data!.id} userId={member.user_id} role={member.role} viewerRole={workspaceResult.data!.role} /></div>)}
  </Card><p className="text-sm text-zinc-500">Invitations are intentionally not enabled yet; role enforcement is being verified first.</p></div></AppLayout>;
}
