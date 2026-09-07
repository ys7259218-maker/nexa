import type { SupabaseClient } from "@supabase/supabase-js";

export type OptOutSource = "whatsapp_keyword";

export interface OptedOutCustomer {
  id: string;
  customer_wa_id: string;
  customer_opted_out_at: string;
  customer_opt_out_source: OptOutSource | null;
  last_message_at: string;
  created_at: string;
}

export interface OptedOutCustomersList {
  customers: OptedOutCustomer[];
  /**
   * Exact total of opted-out conversations (from a head/exact count query, so
   * it is not subject to the 1,000-row returned-row cap).
   */
  total: number;
  /**
   * True when only the newest `OPTED_OUT_LIST_LIMIT` rows were returned and
   * older opts-out exist beyond the list.
   */
  truncated: boolean;
}

export type OptedOutCustomersResult =
  | { data: OptedOutCustomersList; error: null }
  | { data: null; error: string };

export const OPTED_OUT_LIST_LIMIT = 200;

/**
 * Lists conversations whose customer has opted out (RLS-scoped to the signed-in
 * owner). Read-only by design — an opt-out is honored, never silently cleared.
 * The list is bounded to the newest `OPTED_OUT_LIST_LIMIT` opt-outs while an
 * exact head count keeps the true total visible.
 */
export async function listOptedOutCustomers(
  client: SupabaseClient,
): Promise<OptedOutCustomersResult> {
  const [countResult, listResult] = await Promise.all([
    client
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .not("customer_opted_out_at", "is", null),
    client
      .from("conversations")
      .select("id,customer_wa_id,customer_opted_out_at,customer_opt_out_source,last_message_at,created_at")
      .not("customer_opted_out_at", "is", null)
      .order("customer_opted_out_at", { ascending: false })
      .limit(OPTED_OUT_LIST_LIMIT),
  ]);

  const firstError = countResult.error ?? listResult.error;
  if (firstError) {
    return { data: null, error: firstError.message };
  }

  const total = countResult.count ?? 0;
  const customers = (listResult.data ?? []) as OptedOutCustomer[];
  return {
    data: { customers, total, truncated: customers.length < total },
    error: null,
  };
}

export function optOutSourceLabel(source: OptOutSource | null): string {
  if (source === "whatsapp_keyword") return "WhatsApp stop keyword";
  return "Unknown";
}