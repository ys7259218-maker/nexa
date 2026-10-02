/** Gate for the Google Calendar connect flow. Mirrors `reviewRouteGate.ts`:
 * no implicit enablement in production or preview. Staging runs only against
 * the dedicated staging Supabase project; production runs only when an
 * operator opts in with GOOGLE_CALENDAR_PRODUCTION_ENABLED and a non-staging
 * Supabase URL. */
export const STAGING_SUPABASE_REF = "vbizuxxgjlwqotuegskq.supabase.co";

function isSaneSupabaseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.port !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function canEnableGoogleCalendar(env: {
  GOOGLE_CALENDAR_STAGING_ENABLED?: string;
  GOOGLE_CALENDAR_PRODUCTION_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  VERCEL_ENV?: string;
}): boolean {
  if (env.VERCEL_ENV === "production") {
    if (env.GOOGLE_CALENDAR_PRODUCTION_ENABLED !== "true") return false;
    const url = isSaneSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
    return url !== null && url.hostname !== STAGING_SUPABASE_REF;
  }
  if (env.GOOGLE_CALENDAR_STAGING_ENABLED !== "true") return false;
  const url = isSaneSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  return url !== null && url.hostname === STAGING_SUPABASE_REF;
}

/** Accept raw explicit IDs only; never the provider's implicit primary alias.
 * The operator must still verify that the ID belongs to a dedicated test calendar.
 */
export function normalizeStagingCalendarId(value: string): string | null {
  const id = value.trim();
  if (!/^[A-Za-z0-9._+\-@]{3,255}$/.test(id) || id.toLowerCase() === "primary") return null;
  return id;
}
