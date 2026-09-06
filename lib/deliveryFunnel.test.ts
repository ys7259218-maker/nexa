import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeDeliveryFunnel,
  deliveryStageLabel,
  getDeliveryFunnel,
} from "./deliveryFunnel.ts";

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

test("deliveryStageLabel maps every stage to a label", () => {
  assert.equal(deliveryStageLabel("sent"), "Sent");
  assert.equal(deliveryStageLabel("delivered"), "Delivered");
  assert.equal(deliveryStageLabel("read"), "Read");
  assert.equal(deliveryStageLabel("failed"), "Failed");
});

test("getDeliveryFunnel queries outbound messages and reduces to the funnel", async () => {
  let directionArg: string | null = null;
  const client = {
    from: () => ({
      select: () => ({
        eq: async (col: string, value: string) => {
          directionArg = `${col}=${value}`;
          return { data: [{ status: "read" }, { status: "failed" }], error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;

  const result = await getDeliveryFunnel(client);
  assert.equal(directionArg, "direction=outbound");
  assert.equal(result.error, null);
  assert.equal((result.data as { attempted: number }).attempted, 2);
  assert.equal((result.data as { readRatePercent: number }).readRatePercent, 50);
});

test("getDeliveryFunnel maps database errors to a typed failure", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: null, error: { message: "rls denied" } }),
      }),
    }),
  } as unknown as SupabaseClient;

  const result = await getDeliveryFunnel(client);
  assert.equal(result.data, null);
  assert.equal(result.error, "rls denied");
});