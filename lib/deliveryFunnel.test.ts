import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  combineDeliveryCounts,
  computeDeliveryFunnel,
  countOutboundDeliveryStages,
  deliveryStageLabel,
  getDeliveryFunnel,
  type DeliveryStage,
} from "./deliveryFunnel.ts";

type CountCapture = {
  cols: unknown;
  options: unknown;
  calls: Array<[string, unknown]>;
};

function makeCountClient(
  counts: Record<DeliveryStage, number>,
  error: { message: string } | null = null,
): { client: SupabaseClient; captures: CountCapture[] } {
  const captures: CountCapture[] = [];
  const client = {
    from: () => ({
      select: (cols: unknown, options: unknown) => {
        const calls: Array<[string, unknown]> = [];
        captures.push({ cols, options, calls });
        return {
          eq: () => ({
            eq: async (col: string, value: unknown) => {
              calls.push(["direction", "outbound"]);
              calls.push([col, value]);
              if (error) {
                return { data: [], count: null, error };
              }
              const count = counts[value as DeliveryStage] ?? 0;
              return { data: [], count, error: null };
            },
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, captures };
}

test("computeDeliveryFunnel buckets terminal statuses and computes rates", () => {
  const funnel = computeDeliveryFunnel([
    { status: "sent" },
    { status: "sent" },
    { status: "delivered" },
    { status: "read" },
    { status: "read" },
    { status: "failed" },
  ]);
  assert.deepEqual(funnel.stageCounts, { sent: 2, delivered: 1, read: 2, failed: 1 });
  assert.equal(funnel.attempted, 6);
  assert.equal(funnel.deliveredRatePercent, 50);
  assert.equal(funnel.readRatePercent, 33);
  assert.equal(funnel.failedRatePercent, 17);
});

test("computeDeliveryFunnel ignores non-terminal statuses and derives delivered+read", () => {
  const funnel = computeDeliveryFunnel([
    { status: "delivered" },
    { status: "read" },
    { status: "draft_blocked" },
    { status: "received" },
    { status: "weird" },
  ]);
  assert.deepEqual(funnel.stageCounts, { sent: 0, delivered: 1, read: 1, failed: 0 });
  assert.equal(funnel.attempted, 2);
  assert.equal(funnel.deliveredRatePercent, 100);
  assert.equal(funnel.readRatePercent, 50);
  assert.equal(funnel.failedRatePercent, 0);
});

test("computeDeliveryFunnel returns zeros for an empty set", () => {
  const funnel = computeDeliveryFunnel([]);
  assert.deepEqual(funnel.stageCounts, { sent: 0, delivered: 0, read: 0, failed: 0 });
  assert.equal(funnel.attempted, 0);
  for (const rate of [funnel.deliveredRatePercent, funnel.readRatePercent, funnel.failedRatePercent]) {
    assert.equal(rate, 0);
  }
});

test("combineDeliveryCounts is the single source of truth for rate math", () => {
  const funnel = combineDeliveryCounts(2, 1, 2, 1);
  assert.deepEqual(funnel.stageCounts, { sent: 2, delivered: 1, read: 2, failed: 1 });
  assert.equal(funnel.attempted, 6);
  assert.equal(funnel.deliveredRatePercent, 50);
  assert.equal(funnel.readRatePercent, 33);
  assert.equal(funnel.failedRatePercent, 17);
});

test("deliveryStageLabel maps every stage to a label", () => {
  assert.equal(deliveryStageLabel("sent"), "Sent");
  assert.equal(deliveryStageLabel("delivered"), "Delivered");
  assert.equal(deliveryStageLabel("read"), "Read");
  assert.equal(deliveryStageLabel("failed"), "Failed");
});

test("getDeliveryFunnel uses exact aggregate count queries and stays exact past 1,000 messages", async () => {
  const counts = { sent: 1_000, delivered: 600, read: 300, failed: 75 };
  const { client, captures } = makeCountClient(counts);

  const result = await getDeliveryFunnel(client);

  assert.equal(result.error, null);
  const funnel = result.data;
  assert.equal(funnel?.attempted, 1_975);
  assert.deepEqual(funnel?.stageCounts, counts);
  assert.equal(funnel?.deliveredRatePercent, 46);
  assert.equal(funnel?.readRatePercent, 15);
  assert.equal(funnel?.failedRatePercent, 4);

  assert.equal(captures.length, 4, "one aggregate count query per terminal stage");
  for (const capture of captures) {
    assert.deepEqual(capture.options, { count: "exact", head: true }, "counts use exact head queries");
    assert.deepEqual(capture.calls[0], ["direction", "outbound"]);
  }
  assert.deepEqual(
    captures.map((capture) => capture.calls[1][1]),
    ["sent", "delivered", "read", "failed"],
  );
});

test("countOutboundDeliveryStages returns a typed failure when any count query errors", async () => {
  const { client } = makeCountClient(
    { sent: 0, delivered: 0, read: 0, failed: 0 },
    { message: "rls denied" },
  );

  const result = await countOutboundDeliveryStages(client);
  assert.equal(result.data, null);
  assert.equal(result.error, "rls denied");
});

test("getDeliveryFunnel maps aggregate count errors to a typed failure", async () => {
  const { client } = makeCountClient(
    { sent: 0, delivered: 0, read: 0, failed: 0 },
    { message: "rls denied" },
  );

  const result = await getDeliveryFunnel(client);
  assert.equal(result.data, null);
  assert.equal(result.error, "rls denied");
});

test("getDeliveryFunnel and countOutboundDeliveryStages return exact zeros for an empty store", async () => {
  const { client } = makeCountClient({ sent: 0, delivered: 0, read: 0, failed: 0 });

  const funnel = await getDeliveryFunnel(client);
  assert.equal(funnel.error, null);
  assert.deepEqual(funnel.data?.stageCounts, { sent: 0, delivered: 0, read: 0, failed: 0 });
  assert.equal(funnel.data?.attempted, 0);

  const counts = await countOutboundDeliveryStages(client);
  assert.deepEqual(counts, {
    data: { sent: 0, delivered: 0, read: 0, failed: 0 },
    error: null,
  });
});