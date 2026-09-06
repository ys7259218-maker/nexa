import type { SupabaseClient } from "@supabase/supabase-js";

export type OptOutSource = "whatsapp_keyword" | "system";

export interface OptedOutCustomer {
  id: string;
  customer_wa_id: string;
  customer_opted_out_at: string;
  customer_opt_out_source: OptOutSource | null;
  last_message_at: string;
  created_at: string;
}

export type OptedOutCustomersResult =
  | { data: OptedOutCustomer[]; error: null }
  | { data: null; error: string };

/**
 * Lists conversations whose customer has opted out (RLS-scoped to the signed-in
 * owner). Read-only by design — an opt-out is honored, never silently cleared.
 */
export async function listOptedOutCustomers(
  client: SupabaseClient,
): Promise<OptedOutCustomersResult> {
  const { data, error } = await client
    .from("conversations")
    .select("id,customer_wa_id,customer_opted_out_at,customer_opt_out_source,last_message_at,created_at")
    .not("customer_opted_out_at", "is", null)
    .order("customer_opted_out_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as OptedOutCustomer[], error: null };
}

export function optOutSourceLabel(source: OptOutSource | null): string {
  if (source === "whatsapp_keyword") return "WhatsApp stop keyword";
  if (source === "system") return "System";
  return "Unknown";
}