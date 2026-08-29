import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getConversationInbox, maskWhatsAppId } from "./conversations.ts";

type QueryResult = { data: unknown; error: { message: string } | null };

class FakeQuery {
  calls: Array<{ method: string; args: unknown }> = [];
  private readonly result: QueryResult;

  constructor(result: QueryResult) {
    this.result = result;
  }

  select(args?: unknown) {
    this.calls.push({ method: "select", args });
    return this;
  }

  order(column: string, options?: unknown) {
    this.calls.push({ method: "order", args: { column, options } });
    return this;
  }

  eq(column: string, value: unknown) {
    this.calls.push({ method: "eq", args: { column, value } });
    return this;
  }

  then(resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) {
    return Promise.resolve(this.result).then(resolve, reject);
  }
}

function fakeClient(results: Record<string, QueryResult>) {
  const queries: Array<{ table: string; query: FakeQuery }> = [];
  const client = {
    from(table: string) {
      const query = new FakeQuery(results[table] ?? { data: null, error: null });
      queries.push({ table, query });
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, queries };
}

const conversation = {
  id: "conversation-1",
  user_id: "owner-1",
  workspace_id: "workspace-1",
  ai_employee_id: null,
  customer_wa_id: "15551234567",
  automation_mode: "ai",
  human_takeover_at: null,
  customer_opted_out_at: null,
  customer_opt_out_source: null,
  safety_updated_at: "2026-08-24T11:00:00Z",
  safety_updated_by: null,
  last_message_at: "2026-08-24T12:00:00Z",
  created_at: "2026-08-24T11:00:00Z",
};

const message = {
  id: "message-1",
  conversation_id: conversation.id,
  user_id: "owner-1",
  direction: "inbound",
  wa_message_id: "wamid.1",
  message_type: "text",
  body: "Hello",
  status: "received",
  sent_at: null,
  created_at: "2026-08-24T12:00:00Z",
};

test("getConversationInbox loads newest conversations and the selected history", async () => {
  const fake = fakeClient({
    conversations: { data: [conversation], error: null },
    messages: { data: [message], error: null },
  });

  const result = await getConversationInbox(fake.client, conversation.id);
  assert.deepEqual(result, {
    data: { conversations: [conversation], selectedConversation: conversation, messages: [message] },
    error: null,
  });

  assert.deepEqual(fake.queries[0]?.query.calls[1], {
    method: "order",
    args: { column: "last_message_at", options: { ascending: false } },
  });
  assert.ok(fake.queries[1]?.query.calls.some((call) =>
    call.method === "eq" && JSON.stringify(call.args) === JSON.stringify({ column: "conversation_id", value: conversation.id })
  ));
});

test("getConversationInbox defaults to the first conversation and handles empty inboxes", async () => {
  const populated = fakeClient({
    conversations: { data: [conversation], error: null },
    messages: { data: [], error: null },
  });
  const populatedResult = await getConversationInbox(populated.client);
  assert.equal(populatedResult.data?.selectedConversation?.id, conversation.id);

  const empty = fakeClient({ conversations: { data: [], error: null } });
  const emptyResult = await getConversationInbox(empty.client);
  assert.deepEqual(emptyResult, {
    data: { conversations: [], selectedConversation: null, messages: [] },
    error: null,
  });
  assert.equal(empty.queries.length, 1);
});

test("getConversationInbox does not query messages for an unknown requested id", async () => {
  const fake = fakeClient({ conversations: { data: [conversation], error: null } });
  const result = await getConversationInbox(fake.client, "not-owned-or-missing");
  assert.equal(result.data?.selectedConversation, null);
  assert.equal(fake.queries.length, 1);
});

test("getConversationInbox surfaces query errors", async () => {
  const conversationFailure = fakeClient({
    conversations: { data: null, error: { message: "conversation read failed" } },
  });
  assert.deepEqual(await getConversationInbox(conversationFailure.client), {
    data: null,
    error: "conversation read failed",
  });

  const messageFailure = fakeClient({
    conversations: { data: [conversation], error: null },
    messages: { data: null, error: { message: "message read failed" } },
  });
  assert.deepEqual(await getConversationInbox(messageFailure.client), {
    data: null,
    error: "message read failed",
  });
});

test("maskWhatsAppId hides all but the final four digits", () => {
  assert.equal(maskWhatsAppId("15551234567"), "•••• 4567");
  assert.equal(maskWhatsAppId("1234"), "1234");
});
