/** Staging-only gate. No implicit enablement in production or preview. */
export function canQueueAppointmentReview(env: {
  APPOINTMENT_REVIEW_STAGING_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
}): boolean {
  if (env.APPOINTMENT_REVIEW_STAGING_ENABLED !== "true") return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "https:" &&
      url.hostname === "vbizuxxgjlwqotuegskq.supabase.co" &&
      url.pathname === "/" &&
      url.username === "" && url.password === "";
  } catch {
    return false;
  }
}
