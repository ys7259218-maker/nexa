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

  const calendarGate = canEnableGoogleCalendar({
    GOOGLE_CALENDAR_STAGING_ENABLED: process.env.GOOGLE_CALENDAR_STAGING_ENABLED,
    GOOGLE_CALENDAR_PRODUCTION_ENABLED: process.env.GOOGLE_CALENDAR_PRODUCTION_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
  const workspaceResult = client ? await getCurrentWorkspace(client) : null;
  const calendarStatus =
    calendarGate && client && workspaceResult?.data
      ? await readCalendarConnectionStatus(client, workspaceResult.data.id)
      : null;
  const status = calendarStatus?.ok ? calendarStatus.status : null;

  const members = enabled && client ? await listTeamMembers(client, workspaceResult!.data!.id) : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Team settings</h1>
          <p className="mt-2 text-zinc-400">
            {workspaceResult?.data ? `${workspaceResult.data.name} · role-based access` : "Nexa control center"}
          </p>
        </div>

        {params.calendar === "connected" && (
          <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            Google Calendar connected.
          </p>
        )}
        {params.calendar === "error" && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Calendar connection failed. Please try connecting again.
          </p>
        )}

        {workspaceResult?.data && calendarGate && (
          <GoogleCalendarConnection
            workspaceId={workspaceResult.data.id}
            connected={Boolean(status?.connected)}
            provider={status?.provider ?? null}
            calendarId={status?.calendarId ?? null}
            scopes={status?.scopes ?? null}
            tokenExpiresAt={status?.tokenExpiresAt ?? null}
            connectedAt={status?.connectedAt ?? null}
          />
        )}

        {enabled && client ? (
          <>
            <Card className="space-y-4">
              {members?.error ? (
                <p className="text-red-300">{members.error}</p>
              ) : (
                members?.data.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between border-b border-zinc-800 pb-3 last:border-0">
                    <div>
                      <p className="font-medium">Member {maskMemberId(member.user_id)}</p>
                      <p className="text-sm text-zinc-500">
                        Joined <time dateTime={member.created_at}>
                          {new Date(member.created_at).toLocaleDateString()}
                        </time>
                      </p>
                    </div>
                    <TeamMemberRole
                      workspaceId={workspaceResult!.data!.id}
                      userId={member.user_id}
                      role={member.role}
                      viewerRole={workspaceResult!.data!.role}
                    />
                  </div>
                ))
              )}
            </Card>
            <p className="text-sm text-zinc-500">
              Invitations are intentionally not enabled yet; role enforcement is being verified first.
            </p>
          </>
        ) : (
          <Card>
            <h2 className="text-2xl font-bold">Team settings</h2>
            <p className="mt-2 text-amber-300">
              Team management is safely unavailable until its database migration is verified.
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}