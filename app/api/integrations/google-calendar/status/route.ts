import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canEnableGoogleCalendar } from "@/lib/calendar/googleCalendarGate";
import { readCalendarConnectionStatus } from "@/lib/server/googleCalendarStore";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const headers = NO_STORE;
  if (!canEnableGoogleCalendar({
    GOOGLE_CALENDAR_STAGING_ENABLED: process.env.GOOGLE_CALENDAR_STAGING_ENABLED,
    GOOGLE_CALENDAR_PRODUCTION_ENABLED: process.env.GOOGLE_CALENDAR_PRODUCTION_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  })) return Response.json({ error: "not_found" }, { status: 404, headers });

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId || [...url.searchParams.keys()].some(key => key !== "workspaceId") ||
      url.searchParams.getAll("workspaceId").length !== 1 || !UUID.test(workspaceId)) {
    return Response.json({ error: "invalid_workspace" }, { status: 400, headers });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const result = await readCalendarConnectionStatus(supabase, workspaceId);
  if (!result.ok) return Response.json({ error: "unavailable" }, { status: 503, headers });

  const status = result.status ?? {
    connected: false,
    provider: null,
    calendarId: null,
    scopes: null,
    tokenExpiresAt: null,
    connectedAt: null,
  };
  return Response.json(status, { status: 200, headers });
}