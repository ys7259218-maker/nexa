import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canEnableGoogleCalendar } from "@/lib/calendar/googleCalendarGate";
import {
  buildGoogleAuthorizationUrl,
  createOAuthState,
  createPkceVerifier,
  googleCalendarRedirectUri,
  readGoogleCalendarConfig,
  s256Challenge,
} from "@/lib/calendar/googleOAuth";
import { findActorOwnerWorkspace } from "@/lib/server/googleCalendarStore";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };
const OAUTH_COOKIE_MAX_AGE_SECONDS = 3600;

function oauthCookie(name: string, value: string) {
  return {
    name,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function GET(request: Request) {
  if (!canEnableGoogleCalendar({
    GOOGLE_CALENDAR_STAGING_ENABLED: process.env.GOOGLE_CALENDAR_STAGING_ENABLED,
    GOOGLE_CALENDAR_PRODUCTION_ENABLED: process.env.GOOGLE_CALENDAR_PRODUCTION_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  })) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return Response.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
  const { data: actor, error: authError } = await supabase.auth.getUser();
  if (authError || !actor.user?.id) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  }

  const config = readGoogleCalendarConfig(process.env);
  if (!config) {
    return Response.json({ error: "oauth_not_configured" }, { status: 503, headers: NO_STORE });
  }
  const origin = new URL(request.url).origin;
  const redirectUri = googleCalendarRedirectUri(origin);
  if (!redirectUri) {
    return Response.json({ error: "invalid_origin" }, { status: 400, headers: NO_STORE });
  }
  const workspace = await findActorOwnerWorkspace(supabase, actor.user.id);
  if (!workspace.ok) {
    return Response.json(
      { error: workspace.error === "not_authorized" ? "not_authorized" : "unavailable" },
      { status: workspace.error === "not_authorized" ? 403 : 503 },
    );
  }

  const state = createOAuthState();
  const verifier = createPkceVerifier();
  const codeChallenge = s256Challenge(verifier);
  const authorizationUrl = buildGoogleAuthorizationUrl({
    clientId: config.clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  const cookieStore = await cookies();
  cookieStore.set(oauthCookie("gcal_oauth_state", state));
  cookieStore.set(oauthCookie("gcal_oauth_verifier", verifier));
  cookieStore.set(oauthCookie("gcal_oauth_wsid", workspace.workspaceId));

  return NextResponse.redirect(authorizationUrl.toString());
}