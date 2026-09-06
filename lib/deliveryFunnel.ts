import type { SupabaseClient } from "@supabase/supabase-js";

export type DeliveryStage = "sent" | "delivered" | "read" | "failed";

export interface DeliveryFunnel {
  stageCounts: Record<DeliveryStage, number>;
  readRatePercent: number;
  deliveredRatePercent: number;
  failedRatePercent: number;
  attempted: number;
}

/**
 * Computes the outbound delivery funnel from message statuses. `sent` counts
 * any successfully-sent message (sent/delivered/read are mutually exclusive
 * terminal statuses for an outbound message; `failed` is its own bucket).
 */
export function computeDeliveryFunnel(
  messages: Array<{ status: string }>,
): DeliveryFunnel {
  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;

  for (const message of messages) {
    switch (message.status) {
      case "sent":
        sent += 1;
        break;
      case "delivered":
        delivered += 1;
        break;
      case "read":
        read += 1;
        break;
      case "failed":
        failed += 1;
        break;
      default:
        break;
    }
  }

  const attempted = sent + delivered + read + failed;
  const reached = delivered + read;
  const readRatePercent = attempted === 0 ? 0 : Math.round((read / attempted) * 100);
  const deliveredRatePercent = attempted === 0 ? 0 : Math.round((reached / attempted) * 100);
  const failedRatePercent = attempted === 0 ? 0 : Math.round((failed / attempted) * 100);

  return {
    stageCounts: { sent, delivered, read, failed },
    readRatePercent,
    deliveredRatePercent,
    failedRatePercent,
    attempted,
  };
}

export type DeliveryFunnelResult =
  | { data: DeliveryFunnel; error: null }
  | { data: null; error: string };

/**
 * Loads the owner's outbound messages (RLS-scoped) and reduces them into the
 * delivery funnel. Terminal-status outbound messages are all fetched (no
 * LIMIT) so the rates are exact rather than sampled.
 */
export async function getDeliveryFunnel(
  client: SupabaseClient,
): Promise<DeliveryFunnelResult> {
  const { data, error } = await client
    .from("messages")
    .select("status")
    .eq("direction", "outbound");

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: computeDeliveryFunnel((data ?? []) as Array<{ status: string }>), error: null };
}

export function deliveryStageLabel(stage: DeliveryStage): string {
  return ({ sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed" } as Record<DeliveryStage, string>)[stage];
}