import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { canEnableGoogleCalendar } from "@/lib/calendar/googleCalendarGate";
import {
  exchangeGoogleAuthorizationCode,
  encryptSecret,
  readGoogleCalendarConfig,
  CALLBACK_PATH,
} from "@/lib/calendar/googleOAuth";
import { actorIsOwnerOrAdminOf, saveGoogleCalendarConnection } from "@/lib/server/googleCalendarStore";

export const runtime = "nodejs";
const SETTINGS_OK = "/settings/team?calendar=connected";
const SETTINGS_ERROR = "/settings/team?calendar=error";

function errorRedirect(origin: string, cause?: string) {
  if (cause) console.error(`[gcal-diag] branch=${cause}`);
  return NextResponse.redirect(new URL(SETTINGS_ERROR, origin));
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!canEnableGoogleCalendar({
    GOOGLE_CALENDAR_STAGING_ENABLED: process.env.GOOGLE_CALENDAR_STAGING_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
})) {
    return errorRedirect(origin, "gate-fail");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("gcal_oauth_state")?.value;
  const verifier = cookieStore.get("gcal_oauth_verifier")?.value;
  const workspaceId = cookieStore.get("gcal_oauth_wsid")?.value;
  cookieStore.delete("gcal_oauth_state");
  cookieStore.delete("gcal_oauth_verifier");
  cookieStore.delete("gcal_oauth_wsid");

  if (denied || !code || !state || !storedState || !verifier || !workspaceId) {
    return errorRedirect(origin, "params-missing");
  }
  if (!safeEqual(state, storedState)) return errorRedirect(origin, "state-mismatch");

  const config = readGoogleCalendarConfig(process.env);
  if (!config) return errorRedirect(origin, "config-null");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return errorRedirect(origin, "supabase-null");
  const { data: actor, error: authError } = await supabase.auth.getUser();
  if (authError || !actor.user?.id) return errorRedirect(origin, "getuser-fail");
  const isAuthorized = await actorIsOwnerOrAdminOf(supabase, actor.user.id, workspaceId);
  if (!isAuthorized) return errorRedirect(origin, "role-fail");

  const redirectUri = `${origin}${CALLBACK_PATH}`;
  const exchanged = await exchangeGoogleAuthorizationCode({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri,
    code,
    verifier,
  });
  if (!exchanged.ok) {
    console.error(`[gcal-diag] branch=exchange-fail detail=${JSON.stringify(exchanged)}`);
    return errorRedirect(origin, "exchange-fail");
  }

  const service = createSupabaseServiceRoleClient();
  if (!service) return errorRedirect(origin, "service-null");

  const saved = await saveGoogleCalendarConnection({
    service,
    connection: {
      workspaceId,
      accessTokenEncrypted: encryptSecret(exchanged.accessToken, config.tokenKey),
      refreshTokenEncrypted: encryptSecret(exchanged.refreshToken, config.tokenKey),
      scopes: exchanged.scope,
      tokenExpiresAt: new Date(Date.now() + exchanged.expiresInSeconds * 1000).toISOString(),
      connectedByUserId: actor.user.id,
    },
  });
  if (!saved.ok) {
    console.error(`[gcal-diag] branch=save-fail detail=${JSON.stringify(saved)}`);
    return errorRedirect(origin, "save-fail");
  }

  return NextResponse.redirect(new URL(SETTINGS_OK, origin));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}