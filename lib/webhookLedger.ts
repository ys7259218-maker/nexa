import type { SupabaseClient } from "@supabase/supabase-js";

export type WebhookEventStatusFilter =
  | "all"
  | "claimed"
  | "processed"
  | "skipped"
  | "failed";

export type WebhookEventStatus = Exclude<WebhookEventStatusFilter, "all">;

const VALID_STATUSES: WebhookEventStatus[] = [
  "claimed",
  "processed",
  "skipped",
  "failed",
];

/**
 * Validates an unknown (search-param) status filter and returns a typed one,
 * defaulting to "all" for absent or unknown input. Never trusts raw strings.
 */
export function parseWebhookStatusFilter(value: unknown): WebhookEventStatusFilter {
  return VALID_STATUSES.includes(value as WebhookEventStatus) ? (value as WebhookEventStatus) : "all";
}

export function webhookStatusLabel(status: WebhookEventStatus): string {
  return ({ claimed: "Claimed", processed: "Processed", skipped: "Skipped", failed: "Failed" } as Record<WebhookEventStatus, string>)[status];
}

export interface LedgerEvent {
  id: string;
  event_id: string;
  event_kind: string;
  phone_number_id: string;
  from_wa_id: string;
  profile_name: string;
  message_type: string;
  message_body: string;
  occurred_at: string | null;
  status: WebhookEventStatus;
  attempts: number;
  last_error: string;
  received_at: string;
  processed_at: string | null;
}

export type WebhookLedgerResult =
  | { data: LedgerEvent[]; error: null }
  | { data: null; error: string };

/**
 * Reads the durable webhook ledger through the server-only service-role
 * connection. The table is intentionally opaque to normal authenticated
 * clients (no RLS policies), so this must run server-side only.
 */
export async function listWebhookEvents(
  createClient: () => SupabaseClient | null,
  filter: WebhookEventStatusFilter = "all",
  limit = 60,
): Promise<WebhookLedgerResult> {
  const client = createClient();
  if (!client) {
    return {
      data: null,
      error: "Webhook ledger is not configured for this deployment.",
    };
  }

  let query = client.from("webhook_events").select("*");

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  query = query.order("received_at", { ascending: false }).limit(limit);

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as LedgerEvent[], error: null };
}