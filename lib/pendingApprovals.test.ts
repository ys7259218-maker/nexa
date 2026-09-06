import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPendingApprovals } from "./pendingApprovals.ts";

const NOW = new Date("2026-09-06T12:00:00.000Z");

const draftRows = [
  {
    id: "d1",
    conversation_id: "c1",
    body: "Hello",
    message_type: "text",
    wa_message_id: null,
    template_name: null,
    created_at: "2026-09-06T11:00:00.000Z",
  },
  {
    id: "d2",
    conversation_id: "c2",
    body: "Hi there",
    message_type: "text",
    wa_message_id: null,
    template_name: "order_confirmed",
    created_at: "2026-09-06T10:00:00.000Z",
  },
];

async function runList(
  conversations: Array<{ id: string; customer_wa_id: string }>,
  inboundRows: Array<{ conversation_id: string; created_at: string }>,
) {
  const client = {
    from: (table: string) => ({
      select: (columns?: string) => {
        if (table === "conversations") {
          return { eq: () => ({ data: conversations, error: null }) };
        }
        if (columns === "conversation_id,created_at") {
          return { eq: () => ({ data: inboundRows, error: null }) };
        }
        return {
          eq: async () => ({ data: draftRows, error: null }),
        };
      },
    }),
  } as unknown as SupabaseClient;
  return listPendingApprovals(client, true, NOW);
}

test("listPendingApprovals joins conversations, drafts, and last inbound", async () => {
  const result = await runList(
    [
      { id: "c1", customer_wa_id: "15551234567" },
      { id: "c2", customer_wa_id: "15559876543" },
    ],
    [
      { conversation_id: "c1", created_at: "2026-09-05T09:00:00.000Z" },
      { conversation_id: "c1", created_at: "2026-09-06T09:00:00.000Z" },
    ],
  );

  assert.equal(result.error, null);
  const data = result.data as Array<{ customer_wa_id: string; last_inbound_at: string }>;
  assert.equal(data.length, 2);
  assert.equal(data[0].customer_wa_id, "15551234567");
  assert.equal(data[0].last_inbound_at, "2026-09-06T09:00:00.000Z");
});

test("listPendingApprovals opens the window only inside the service window", async () => {
  const result = await runList(
    [
      { id: "c1", customer_wa_id: "15551234567" },
      { id: "c2", customer_wa_id: "15559876543" },
    ],
    [
      { conversation_id: "c1", created_at: "2026-09-06T11:00:00.000Z" },
      { conversation_id: "c2", created_at: "2026-09-01T08:00:00.000Z" },
    ],
  );

  const data = result.data as Array<{ windowOpen: boolean }>;
  assert.equal(data[0].windowOpen, true);
  assert.equal(data[1].windowOpen, false);
});

test("listPendingApprovals disables the window when outbound is not ready", async () => {
  const client = {
    from: (table: string) => ({
      select: (columns?: string) => {
        if (table === "conversations") {
          return { eq: () => ({ data: [{ id: "c1", customer_wa_id: "15551234567" }], error: null }) };
        }
        if (columns === "conversation_id,created_at") {
          return { eq: () => ({ data: [{ conversation_id: "c1", created_at: "2026-09-06T11:00:00.000Z" }], error: null }) };
        }
        return { eq: async () => ({ data: draftRows, error: null }) };
      },
    }),
  } as unknown as SupabaseClient;

  const result = await listPendingApprovals(client, false, NOW);
  const data = result.data as Array<{ windowOpen: boolean }>;
  assert.equal(data[0].windowOpen, false);
  assert.equal(data[1].windowOpen, false);
});

test("listPendingApprovals reports a typed failure on any query error", async () => {
  const client = {
    from: (table: string) => ({
      select: () => {
        if (table === "conversations") {
          return { data: null, error: { message: "boom" } };
        }
        return { data: [], error: null };
      },
    }),
  } as unknown as SupabaseClient;

  const result = await listPendingApprovals(client, true, NOW);
  assert.equal(result.data, null);
  assert.equal(result.error, "boom");
});