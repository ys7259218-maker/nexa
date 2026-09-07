import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listFailedSends } from "./failedSends.ts";
import {
  isValidMessageIdList,
  retryFailedSends,
  type FailedSendRetryItem,
} from "./retryFailedSends.ts";
import type { ApproveDraftOutcome } from "./server/draftSender.ts";

const NOW = new Date("2026-09-06T12:00:00Z");

function makeClient(rows: {
  conversations?: Array<{ id: string; customer_wa_id: string }>;
  sends?: Array<Record<string, unknown>>;
  inbounds?: Array<{ conversation_id: string; created_at: string }>;
  error?: { message: string };
}): SupabaseClient {
  const conversations = rows.conversations ?? [];
  const sends = rows.sends ?? [];
  const inbounds = rows.inbounds ?? [];
  const dbError = rows.error ?? null;
  return {
    from: (table: string) => {
      if (table === "conversations") {
        return {
          select: async () => ({ data: dbError ? null : conversations, error: dbError }),
        };
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
                order: async () => ({ data: dbError ? null : sends, error: dbError }),
              }),
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const CONVERSATION = { id: "c1", customer_wa_id: "15551234567" };

function freeFormSend(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    conversation_id: "c1",
    body: `body ${id}`,
    message_type: "text",
    wa_message_id: null,
    template_name: null,
    created_at: "2026-09-05T10:00:00Z",
    ...overrides,
  };
}

test("retryFailedSends resubmits only retryable sends and reports queued/skipped", async () => {
  const client = makeClient({
    conversations: [CONVERSATION],
    sends: [
      freeFormSend("m1"),
      freeFormSend("m2", { template_name: "order_confirmed", message_type: "hsm" }),
    ],
    inbounds: [{ conversation_id: "c1", created_at: "2026-09-06T11:30:00Z" }],
  });
  const attempted: string[] = [];
  const sendDraft = async (messageId: string): Promise<ApproveDraftOutcome> => {
    attempted.push(messageId);
    return { ok: true, wamid: "wamid.retry.1" };
  };

  const result = await retryFailedSends(client, "u1", true, { now: NOW, sendDraft });

  assert.equal(result.error, null);
  assert.deepEqual(attempted, ["m1"], "template-based failed sends are never auto-retried");
  const results = (result as { results: FailedSendRetryItem[] }).results;
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    messageId: "m1",
    queued: true,
    reason: undefined,
  });
});

test("retryFailedSends honors an explicit messageIds selection", async () => {
  const client = makeClient({
    conversations: [CONVERSATION],
    sends: [freeFormSend("m1"), freeFormSend("m2")],
    inbounds: [{ conversation_id: "c1", created_at: "2026-09-06T11:30:00Z" }],
  });
  const attempted: string[] = [];
  const sendDraft = async (messageId: string): Promise<ApproveDraftOutcome> => {
    attempted.push(messageId);
    return { ok: false, code: "send_failed", message: "WhatsApp did not accept the message." };
  };

  const result = await retryFailedSends(client, "u1", true, {
    now: NOW,
    messageIds: ["m2"],
    sendDraft,
  });

  assert.equal(result.error, null);
  assert.deepEqual(attempted, ["m2"]);
  const results = (result as { results: FailedSendRetryItem[] }).results;
  assert.deepEqual(results[0], {
    messageId: "m2",
    queued: false,
    reason: "WhatsApp did not accept the message.",
  });
});

test("retryFailedSends maps a throwing per-send action to a skipped result", async () => {
  const client = makeClient({
    conversations: [CONVERSATION],
    sends: [freeFormSend("m1")],
    inbounds: [{ conversation_id: "c1", created_at: "2026-09-06T11:30:00Z" }],
  });

  const result = await retryFailedSends(client, "u1", true, {
    now: NOW,
    sendDraft: async () => {
      throw new Error("sensitive transport detail");
    },
  });

  assert.equal(result.error, null);
  const results = (result as { results: FailedSendRetryItem[] }).results;
  assert.deepEqual(results[0], {
    messageId: "m1",
    queued: false,
    reason: "The retry request failed.",
  });
});

test("retryFailedSends propagates a queue-load error as a typed failure", async () => {
  const client = makeClient({ error: { message: "rls denied" } });

  const result = await retryFailedSends(client, "u1", true, { now: NOW });

  assert.equal(result.results, null);
  assert.equal(result.error, "rls denied");
});

test("retryFailedSends returns an empty batch when nothing is retryable", async () => {
  const client = makeClient({
    conversations: [CONVERSATION],
    sends: [freeFormSend("m1")],
    inbounds: [{ conversation_id: "c1", created_at: "2026-09-01T10:00:00Z" }],
  });
  let calls = 0;
  const sendDraft = async (): Promise<ApproveDraftOutcome> => {
    calls += 1;
    return { ok: true, wamid: "w" };
  };

  const result = await retryFailedSends(client, "u1", true, { now: NOW, sendDraft });

  assert.equal(result.error, null);
  assert.equal((result as { results: unknown[] }).results.length, 0);
  assert.equal(calls, 0, "closed-window sends are not candidates");
});

test("isValidMessageIdList bounds and validates draft message ids", async () => {
  const validId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(isValidMessageIdList([validId]), true);
  assert.equal(isValidMessageIdList([validId, validId]), true);
  assert.equal(isValidMessageIdList([]), false, "an empty selection is not meaningful");
  assert.equal(isValidMessageIdList([validId, "not-a-uuid"]), false);
  assert.equal(isValidMessageIdList("123e4567-e89b-42d3-a456-426614174000"), false);
  assert.equal(
    isValidMessageIdList(Array(21).fill(validId)),
    false,
    "a batch past the cap is rejected",
  );
  assert.equal(
    isValidMessageIdList(Array(20).fill(validId)),
    true,
    "a max-size batch is permitted",
  );
});

test("listFailedSends remains importable for the retry helper", async () => {
  const client = makeClient({
    conversations: [CONVERSATION],
    sends: [freeFormSend("m1")],
    inbounds: [{ conversation_id: "c1", created_at: "2026-09-06T11:30:00Z" }],
  });
  const result = await listFailedSends(client, true, NOW);
  assert.equal(result.error, null);
  assert.equal((result.data ?? [])[0].retryable, true);
});