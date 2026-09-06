import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listFailedSends } from "./failedSends.ts";

const NOW = new Date("2026-09-06T12:00:00Z");

function makeClient(rows: {
  conversations?: Array<{ id: string; customer_wa_id: string }>;
  sends?: Array<Record<string, unknown>>;
  inbounds?: Array<{ conversation_id: string; created_at: string }>;
}): SupabaseClient {
  const conversations = rows.conversations ?? [];
  const sends = rows.sends ?? [];
  const inbounds = rows.inbounds ?? [];
  return {
    from: (table: string) => {
      if (table === "conversations") {
        return { select: async () => ({ data: conversations, error: null }) };
      }
      return {
        select: (cols: string) => {
          if (cols !== "*") {
            return {
              eq: async (_c: string, value: unknown) =>
                value === "inbound"
                  ? { data: inbounds, error: null }
                  : { data: [], error: null },
            };
          }
          return {
            eq: () => ({
              eq: () => ({
                order: async () => ({ data: sends, error: null }),
              }),
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const CONVERSATION = { id: "c1", customer_wa_id: "15551234567" };

test("listFailedSends marks only window-open free-form failures as retryable", async () => {
  const client = makeClient({
    conversations: [CONVERSATION],
    sends: [
      {
        id: "m1",
        conversation_id: "c1",
        body: "retry me",
        message_type: "text",
        wa_message_id: "wamid.1",
        template_name: null,
        created_at: "2026-09-05T10:00:00Z",
      },
      {
        id: "m2",
        conversation_id: "c1",
        body: "template send",
        message_type: "hsm",
        wa_message_id: "wamid.2",
        template_name: "order_confirmed",
        created_at: "2026-09-05T10:01:00Z",
      },
    ],
    inbounds: [{ conversation_id: "c1", created_at: "2026-09-06T11:00:00Z" }],
  });

  const result = await listFailedSends(client, true, NOW);
  assert.equal(result.error, null);
  const data = result.data ?? [];
  assert.equal(data.length, 2);
  assert.equal(data[0].id, "m1");
  assert.equal(data[0].windowOpen, true);
  assert.equal(data[0].retryable, true);
  assert.equal(data[1].id, "m2");
  assert.equal(data[1].windowOpen, true);
  assert.equal(data[1].retryable, false, "template-based sends cannot auto-retry");
});

test("listFailedSends closes the retry when outbound is disabled or the window closed", async () => {
  const client = makeClient({
    conversations: [CONVERSATION],
    sends: [
      {
        id: "m1",
        conversation_id: "c1",
        body: "stale",
        message_type: "text",
        wa_message_id: null,
        template_name: null,
        created_at: "2026-09-01T10:00:00Z",
      },
    ],
    inbounds: [{ conversation_id: "c1", created_at: "2026-09-06T12:10:00Z" }],
  });

  const disabled = await listFailedSends(client, false, NOW);
  assert.equal((disabled.data ?? [])[0].retryable, false);
  assert.equal((disabled.data ?? [])[0].windowOpen, false);

  const stale = await listFailedSends(client, true, new Date("2026-09-08T00:00:00Z"));
  assert.equal((stale.data ?? [])[0].retryable, false);
  assert.equal((stale.data ?? [])[0].windowOpen, false);
});

test("listFailedSends maps database errors to a typed failure", async () => {
  const client = {
    from: (table: string) => {
      if (table === "conversations") {
        return { select: async () => ({ data: [], error: { message: "rls denied" } }) };
      }
      return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) };
    },
  } as unknown as SupabaseClient;

  const result = await listFailedSends(client, true, NOW);
  assert.equal(result.data, null);
  assert.equal(result.error, "rls denied");
});