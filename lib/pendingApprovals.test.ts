import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INBOUND_WINDOW_SCAN_MS,
  PENDING_APPROVALS_LIMIT,
  listPendingApprovals,
} from "./pendingApprovals.ts";

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
  total = draftRows.length,
) {
  const client = {
    from: (table: string) => ({
      select: (columns?: string, options?: { count?: string; head?: boolean }) => {
        if (table === "conversations") {
          return { in: async () => ({ data: conversations, error: null }) };
        }
        if (columns === "conversation_id,created_at") {
          return { eq: () => ({ gte: async () => ({ data: inboundRows, error: null }) }) };
        }
        if (options?.head) {
          return { eq: () => ({ eq: async () => ({ data: [], count: total, error: null }) }) };
        }
        return {
          eq: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: draftRows, error: null }) }),
            }),
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;
  return listPendingApprovals(client, true, NOW);
}

test("listPendingApprovals joins drafts, their conversations, and last inbound", async () => {
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
  const data = result.data as {
    approvals: Array<{ customer_wa_id: string; last_inbound_at: string }>;
  };
  assert.equal(data.approvals.length, 2);
  assert.equal(data.approvals[0].customer_wa_id, "15551234567");
  assert.equal(data.approvals[0].last_inbound_at, "2026-09-06T09:00:00.000Z");
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

  const data = result.data as { approvals: Array<{ windowOpen: boolean }> };
  assert.equal(data.approvals[0].windowOpen, true);
  assert.equal(data.approvals[1].windowOpen, false);
});

test("listPendingApprovals exposes the exact backlog and truncation flag", async () => {
  const result = await runList(
    [{ id: "c1", customer_wa_id: "15551234567" }],
    [{ conversation_id: "c1", created_at: "2026-09-06T11:00:00.000Z" }],
    12,
  );

  assert.equal(result.error, null);
  const data = result.data as { total: number; truncated: boolean };
  assert.equal(data.total, 12);
  assert.equal(data.truncated, true);
});

test("listPendingApprovals disables the window when outbound is not ready", async () => {
  const client = {
    from: (table: string) => ({
      select: (columns?: string, options?: { count?: string; head?: boolean }) => {
        if (table === "conversations") {
          return { in: async () => ({ data: [{ id: "c1", customer_wa_id: "15551234567" }], error: null }) };
        }
        if (columns === "conversation_id,created_at") {
          return { eq: () => ({ gte: async () => ({ data: [{ conversation_id: "c1", created_at: "2026-09-06T11:00:00.000Z" }], error: null }) }) };
        }
        if (options?.head) {
          return { eq: () => ({ eq: async () => ({ data: [], count: draftRows.length, error: null }) }) };
        }
        return { eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: draftRows, error: null }) }) }) }) };
      },
    }),
  } as unknown as SupabaseClient;

  const result = await listPendingApprovals(client, false, NOW);
  const data = result.data as { approvals: Array<{ windowOpen: boolean }> };
  assert.equal(data.approvals[0].windowOpen, false);
  assert.equal(data.approvals[1].windowOpen, false);
});

test("listPendingApprovals bounds the drafts list and the inbound scan", async () => {
  const calls: { table: string; limit?: number; gte?: string }[] = [];
  const client = {
    from: (table: string) => ({
      select: (columns?: string, options?: { count?: string; head?: boolean }) => {
        if (table === "conversations") {
          return { in: async () => ({ data: [], error: null }) };
        }
        if (columns === "conversation_id,created_at") {
          return {
            eq: () => {
              calls.push({ table });
              return {
                gte: async (_col: string, value: string) => {
                  calls.push({ table, gte: value });
                  return { data: [], error: null };
                },
              };
            },
          };
        }
        if (options?.head) {
          return { eq: () => ({ eq: async () => ({ data: [], count: 0, error: null }) }) };
        }
        return {
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async (value: number) => {
                  calls.push({ table, limit: value });
                  return { data: [], error: null };
                },
              }),
            }),
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;

  await listPendingApprovals(client, true, NOW);

  const draftsCall = calls.find((call) => call.limit !== undefined);
  assert.equal(draftsCall?.limit, PENDING_APPROVALS_LIMIT, "drafts list is capped");

  const inboundCall = calls.find((call) => call.gte !== undefined);
  const expectedFrom = new Date(NOW.getTime() - INBOUND_WINDOW_SCAN_MS).toISOString();
  assert.equal(inboundCall?.gte, expectedFrom, "inbound scan is bounded to the service window");
});

test("listPendingApprovals reports a typed failure on any query error", async () => {
  const client = {
    from: (table: string) => ({
      select: (columns?: string, options?: { count?: string; head?: boolean }) => {
        if (table === "conversations") {
          return { in: async () => ({ data: [], error: { message: "boom" } }) };
        }
        if (columns === "conversation_id,created_at") {
          return { eq: () => ({ gte: async () => ({ data: [], error: null }) }) };
        }
        if (options?.head) {
          return { eq: () => ({ eq: async () => ({ data: [], count: 0, error: null }) }) };
        }
        return {
          eq: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: [draftRows[0]], error: null }) }),
            }),
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;

  const result = await listPendingApprovals(client, true, NOW);
  assert.equal(result.data, null);
  assert.equal(result.error, "boom");
});