import type { SupabaseClient } from "@supabase/supabase-js";

export type DeliveryStage = "sent" | "delivered" | "read" | "failed";

export const DELIVERY_STAGES: DeliveryStage[] = ["sent", "delivered", "read", "failed"];

export interface DeliveryFunnel {
  stageCounts: Record<DeliveryStage, number>;
  readRatePercent: number;
  deliveredRatePercent: number;
  failedRatePercent: number;
  attempted: number;
}

/**
 * Builds the exact delivery funnel from per-stage totals. This is the single
 * source of truth for rate math; `computeDeliveryFunnel` reduces raw rows into
 * these totals, while the database path derives them from exact count queries.
 */
export function combineDeliveryCounts(
  sent: number,
  delivered: number,
  read: number,
  failed: number,
): DeliveryFunnel {
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

/**
 * Computes the outbound delivery funnel from message statuses. `sent` counts
 * any successfully-sent message (sent/delivered/read are mutually exclusive
 * terminal statuses for an outbound message; `failed` is its own bucket).
 * Use only for in-memory reductions (tests, fixtures); the live path reads
 * exact counts so it is not truncated by PostgREST's row cap.
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

  return combineDeliveryCounts(sent, delivered, read, failed);
}

export type DeliveryCounts = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export type DeliveryCountsResult =
  | { data: DeliveryCounts; error: null }
  | { data: null; error: string };

/**
 * Loads this account's terminal outbound message tallies with exact aggregate
 * count queries (`count: "exact"`, `head: true`). Postgres computes the counts,
 * and PostgREST never returns rows for a head request, so totals are exact past
 * the default 1,000-row response cap. RLS scopes the counts to the owner; no
 * service-role key is used.
 */
export async function countOutboundDeliveryStages(
  client: SupabaseClient,
): Promise<DeliveryCountsResult> {
  const results = await Promise.all(
    DELIVERY_STAGES.map((status) =>
      client
        .from("messages")
        .select("status", { count: "exact", head: true })
        .eq("direction", "outbound")
        .eq("status", status),
    ),
  );

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    return { data: null, error: firstError.message };
  }

  const [sent, delivered, read, failed] = results.map((result) => result.count ?? 0);
  return { data: { sent, delivered, read, failed }, error: null };
}

export type DeliveryFunnelResult =
  | { data: DeliveryFunnel; error: null }
  | { data: null; error: string };

/**
 * Loads the owner's terminal outbound delivery funnel from exact aggregate
 * counts (RLS-scoped). Counts are exact regardless of how many outbound
 * messages exist, so the funnel is never truncated at PostgREST's row cap.
 */
export async function getDeliveryFunnel(
  client: SupabaseClient,
): Promise<DeliveryFunnelResult> {
  const counts = await countOutboundDeliveryStages(client);
  if (counts.error !== null) {
    return { data: null, error: counts.error };
  }

  return {
    data: combineDeliveryCounts(counts.data.sent, counts.data.delivered, counts.data.read, counts.data.failed),
    error: null,
  };
}

export function deliveryStageLabel(stage: DeliveryStage): string {
  return ({ sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed" } as Record<DeliveryStage, string>)[stage];
}