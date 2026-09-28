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

/** Accept raw explicit IDs only; never the provider's implicit primary alias.
 * The operator must still verify that the ID belongs to a dedicated test calendar.
 */
export function normalizeStagingCalendarId(value: string): string | null {
  const id = value.trim();
  if (!/^[A-Za-z0-9._+\-@]{3,255}$/.test(id) || id.toLowerCase() === "primary") return null;
  return id;
}
