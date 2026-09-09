import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasRecentProcessedInboundEvent,
  INBOUND_PROOF_FRESHNESS_MS,
  INBOUND_PROOF_MAX_CLOCK_SKEW_MS,
} from "./inboundReadinessProof.ts";

const employeeId = "11111111-1111-4111-8111-111111111111";
const ASSIGNED_PHONE = "phone_12345";
const OTHER_PHONE = "phone_99999";

const now = new Date("2026-09-10T12:00:00Z");
const recentIso = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
const freshBoundaryIso = new Date(now.getTime() - INBOUND_PROOF_FRESHNESS_MS).toISOString();
const justStaleBoundaryIso = new Date(
  now.getTime() - INBOUND_PROOF_FRESHNESS_MS - 1,
).toISOString();
const staleIso = new Date(now.getTime() - INBOUND_PROOF_FRESHNESS_MS - 60 * 60 * 1000).toISOString();
const withinSkewFutureIso = new Date(now.getTime() + 60 * 1000).toISOString();
const skewBoundaryFutureIso = new Date(
  now.getTime() + INBOUND_PROOF_MAX_CLOCK_SKEW_MS,
).toISOString();
const beyondSkewFutureIso = new Date(
  now.getTime() + INBOUND_PROOF_MAX_CLOCK_SKEW_MS + 60 * 1000,
).toISOString();

type Call = [table: string, method: string, args: unknown[]];
type MockModel = {
  channelRows?: Array<{ phone_number_id: string | null }>;
  channelError?: { message: string };
  eventRows?: Array<{ processed_at: string | null }>;
  eventError?: { message: string };
};

function mockServiceClient(model: MockModel): { client: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];

  const channelQuery = {
    select: () => ({
      eq: async (col: string, value: string) => {
        calls.push(["whatsapp_channels", "eq", [col, value]]);
        return { data: model.channelRows ?? [], error: model.channelError ?? null };
      },
    }),
  };

  const eventQuery = {
    select: () => {
      const chain = {
        in: (col: string, values: string[]) => {
          calls.push(["webhook_events", "in", [col, values]]);
          return chain;
        },
        eq: (col: string, value: string) => {
          calls.push(["webhook_events", "eq", [col, value]]);
          return chain;
        },
        gte: (col: string, value: string) => {
          calls.push(["webhook_events", "gte", [col, value]]);
          return chain;
        },
        order: (col: string, opts: unknown) => {
          calls.push(["webhook_events", "order", [col, opts]]);
          return chain;
        },
        limit: async (n: number) => {
          calls.push(["webhook_events", "limit", [n]]);
          return { data: model.eventRows ?? [], error: model.eventError ?? null };
        },
      };
      return chain;
    },
  };

  const client = {
    from: (table: string) => (table === "whatsapp_channels" ? channelQuery : eventQuery),
  } as unknown as SupabaseClient;

  return { client, calls };
}

function withAssignmentEnabled(enabled: boolean, fn: () => Promise<void>): Promise<void> {
  const previous = process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED;
  process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED = enabled ? "true" : "false";
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED;
    else process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED = previous;
  }
}

test("disabling channel assignment fails closed with no database reads", async () => {
  await withAssignmentEnabled(false, async () => {
    const { client, calls } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: recentIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
    assert.equal(calls.length, 0);
  });
});

test("a recent processed message event on the assigned channel proves inbound readiness", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client, calls } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: recentIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), true);
    assert.ok(
      calls.some((call) => call[0] === "whatsapp_channels" && call[1] === "eq"),
    );
    assert.ok(
      calls.some(
        (call) =>
          call[0] === "webhook_events" &&
          call[1] === "in" &&
          call[2][0] === "phone_number_id" &&
          JSON.stringify(call[2][1]) === JSON.stringify([ASSIGNED_PHONE]),
      ),
    );
    assert.ok(
      calls.some((call) => call[0] === "webhook_events" && call[1] === "eq"),
    );
    assert.ok(
      calls.some((call) => call[0] === "webhook_events" && call[1] === "eq" && call[2][0] === "status" && call[2][1] === "processed"),
    );
  });
});

test("an event on a different channel than the assigned one yields no proof", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client, calls } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      // The only processed event belongs to OTHER_PHONE; the status filter
      // must therefore never observe it as a match.
      eventRows: [],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
    assert.ok(
      calls.some(
        (call) =>
          call[0] === "webhook_events" &&
          call[1] === "in" &&
          String(call[2][1]).includes(ASSIGNED_PHONE) &&
          !String(call[2][1]).includes(OTHER_PHONE),
      ),
    );
    assert.equal(calls.some((call) => call[1] === "limit"), true);
  });
});

test("a stale processed event older than the freshness window fails closed", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: staleIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
  });
});

test("an event exactly at the freshness boundary counts as proof", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: freshBoundaryIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), true);
  });
});

test("an event one millisecond past the freshness boundary fails closed", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: justStaleBoundaryIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
  });
});

test("a processed_at far in the future fails closed", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: beyondSkewFutureIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
  });
});

test("a processed_at within the bounded clock skew still counts as proof", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: withinSkewFutureIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), true);
  });
});

test("a processed_at exactly at the clock skew boundary counts as proof", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: skewBoundaryFutureIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), true);
  });
});

test("failed or skipped events never satisfy the processed-event proof", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client, calls } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      // A failed/skipped row is not returned because the ledger query filters
      // status = 'processed'; without a processed event nothing proves readiness.
      eventRows: [],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
    assert.ok(
      calls.some(
        (call) =>
          call[0] === "webhook_events" &&
          call[1] === "eq" &&
          call[2][0] === "status" &&
          call[2][1] === "processed",
      ),
    );
  });
});

test("a missing processed_at timestamp fails closed", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: null }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
  });
});

test("an unparseable processed_at timestamp fails closed", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventRows: [{ processed_at: "not-a-timestamp" }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
  });
});

test("a channel lookup error fails closed", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client, calls } = mockServiceClient({
      channelError: { message: "permission denied" },
      eventRows: [{ processed_at: recentIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
    assert.equal(calls.some((call) => call[0] === "webhook_events"), false);
  });
});

test("a webhook_events query error fails closed", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client } = mockServiceClient({
      channelRows: [{ phone_number_id: ASSIGNED_PHONE }],
      eventError: { message: "relation does not exist" },
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
  });
});

test("no assigned channel yields no proof and skips the ledger query", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client, calls } = mockServiceClient({
      channelRows: [],
      eventRows: [{ processed_at: recentIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
    assert.equal(calls.some((call) => call[0] === "webhook_events"), false);
  });
});

test("an assigned channel with an empty phone number id yields no proof", async () => {
  await withAssignmentEnabled(true, async () => {
    const { client, calls } = mockServiceClient({
      channelRows: [{ phone_number_id: "" }],
      eventRows: [{ processed_at: recentIso }],
    });
    assert.equal(await hasRecentProcessedInboundEvent(client, employeeId, now), false);
    assert.equal(calls.some((call) => call[0] === "webhook_events"), false);
  });
});