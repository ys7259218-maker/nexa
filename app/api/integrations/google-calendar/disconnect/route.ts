import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { canEnableGoogleCalendar } from "@/lib/calendar/googleCalendarGate";
import { isSameOriginReviewRequest } from "@/lib/actions/reviewOriginGuard";
import { readRequestTextWithLimit, RequestBodyTooLargeError } from "@/lib/requestBody";
import { actorIsOwnerOrAdminOf, disconnectGoogleCalendar } from "@/lib/server/googleCalendarStore";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const headers = NO_STORE;
  const gateEnabled = canEnableGoogleCalendar({
    GOOGLE_CALENDAR_STAGING_ENABLED: process.env.GOOGLE_CALENDAR_STAGING_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
  if (!gateEnabled) return Response.json({ error: "not_found" }, { status: 404, headers });
  if (!isSameOriginReviewRequest(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "invalid_request" }, { status: 415, headers });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const { data: actor, error: authError } = await supabase.auth.getUser();
  if (authError || !actor.user?.id) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers });
  }

  let payload: unknown;
  try {
    const body = await readRequestTextWithLimit(request, 4096);
    payload = JSON.parse(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof RequestBodyTooLargeError ? "body_too_large" : "invalid_request" },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const body = payload as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!UUID.test(workspaceId)) return Response.json({ error: "invalid_request" }, { status: 400, headers });

  const isAuthorized = await actorIsOwnerOrAdminOf(supabase, actor.user.id, workspaceId);
  if (!isAuthorized) return Response.json({ error: "not_authorized" }, { status: 403, headers });

  const service = createSupabaseServiceRoleClient();
  if (!service) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const result = await disconnectGoogleCalendar({ service, workspaceId });
  if (!result.ok) return Response.json({ error: "unavailable" }, { status: 503, headers });
  return Response.json({ ok: true }, { status: 200, headers });
}