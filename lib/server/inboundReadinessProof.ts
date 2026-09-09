import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Conservative freshness window for inbound-runtime proof. A message event
 * counts only if this server processed it within this many milliseconds of
 * "now". Matches the activation evidence TTL (see EVIDENCE_TTL_MS) so stored
 * evidence and runtime proof share one bounded freshness horizon.
 */
export const INBOUND_PROOF_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum allowed clock skew between this server and the recorded event.
 * A processed_at far in the future is rejected outright; only a tiny bounded
 * skew (this many milliseconds ahead of "now") is tolerated so a lightly
 * skewed database clock cannot cause a durable proof to be treated as absent.
 */
export const INBOUND_PROOF_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Proves inbound readiness from durable server-only state. Returns true only
 * when a message event that this server already processed exists in
 * webhook_events for a WhatsApp channel actually assigned to the employee.
 *
 * Fails closed (false) whenever:
 *   - channel assignment is disabled
 *   - the channel lookup errors
 *   - no channel is assigned to the employee
 *   - the assigned channels have no usable phone number ids
 *   - no processed message event matches the assigned phone number ids
 *   - the matching event predates the freshness window
 *   - the event's processed_at is in the future beyond the tiny bounded skew
 *   - the event's processed_at is missing or unparseable
 *   - the webhook_events query errors
 *
 * Only phone_number_id and processed_at are selected; ledger/customer content
 * (message bodies, from_wa_id, profile names) is never read or returned.
 */
export async function hasRecentProcessedInboundEvent(
  serviceClient: SupabaseClient,
  employeeId: string,
  now: Date = new Date(),
  freshnessMs: number = INBOUND_PROOF_FRESHNESS_MS,
  maxClockSkewMs: number = INBOUND_PROOF_MAX_CLOCK_SKEW_MS,
): Promise<boolean> {
  if (process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED !== "true") return false;

  try {
    const { data: channels, error: channelError } = await serviceClient
      .from("whatsapp_channels")
      .select("phone_number_id")
      .eq("ai_employee_id", employeeId);

    if (channelError || !channels) return false;

    const phoneNumberIds = (channels as Array<{ phone_number_id?: string | null }>)
      .map((channel) => channel.phone_number_id)
      .filter((value): value is string => Boolean(value));

    if (phoneNumberIds.length === 0) return false;

    const cutoff = new Date(now.getTime() - freshnessMs).toISOString();

    const { data: events, error: eventsError } = await serviceClient
      .from("webhook_events")
      .select("processed_at")
      .in("phone_number_id", phoneNumberIds)
      .eq("event_kind", "message")
      .eq("status", "processed")
      .gte("processed_at", cutoff)
      .order("processed_at", { ascending: false })
      .limit(1);

    if (eventsError || !events || events.length === 0) return false;

    const processedAt = (events[0] as { processed_at?: string | null }).processed_at;
    if (!processedAt) return false;

    const processedMs = Date.parse(processedAt);
    if (Number.isNaN(processedMs)) return false;

    const ageMs = now.getTime() - processedMs;
    if (ageMs < -maxClockSkewMs) return false;
    return ageMs <= freshnessMs;
  } catch {
    return false;
  }
}