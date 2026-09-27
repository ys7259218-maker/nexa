/** Staging-only gate for the Google Calendar connect flow. Mirrors
 * `reviewRouteGate.ts`: no implicit enablement in production or preview. */
export const STAGING_SUPABASE_REF = "vbizuxxgjlwqotuegskq.supabase.co";

export function canEnableGoogleCalendar(env: {
  GOOGLE_CALENDAR_STAGING_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  VERCEL_ENV?: string;
}): boolean {
  if (env.GOOGLE_CALENDAR_STAGING_ENABLED !== "true" || env.VERCEL_ENV === "production") return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "https:" &&
      url.hostname === STAGING_SUPABASE_REF &&
      url.pathname === "/" && url.port === "" && url.search === "" && url.hash === "" &&
      url.username === "" && url.password === "";
  } catch {
    return false;
  }
}