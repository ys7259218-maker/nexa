import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conversationSafetyIndicator,
  countPriorInboundTurns,
  customerWaIdMatches,
  explainMissingDraft,
  formatWindowRemaining,
  getConversationInbox,
  lastInboundMessageAt,
  maskOpaqueId,
  maskWhatsAppId,
  outboundStatusLabel,
  parseConversationTriageFilter,
  parseCustomerSearchValue,
  priorInboundTurnsBefore,
  serviceWindowRemainingMs,
  type Conversation,
  type ConversationMessage,
} from "./conversations.ts";

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

  in(column: string, values: unknown) {
    this.calls.push({ method: "in", args: { column, values } });
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

const conversation: Conversation = {
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
  template_name: null,
  message_type: "text",
  body: "Hello",
  status: "received",
  failure_reason: null,
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
    data: {
      conversations: [conversation],
      selectedConversation: conversation,
      messages: [message],
      pendingDraftCounts: { "conversation-1": 1 },
    },
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
    data: { conversations: [], selectedConversation: null, messages: [], pendingDraftCounts: {} },
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

test("getConversationInbox counts pending AI drafts per conversation with owner-scoped filters", async () => {
  const second = { ...conversation, id: "conversation-2" };
  const draftRows = [
    { conversation_id: "conversation-1" },
    { conversation_id: "conversation-2" },
    { conversation_id: "conversation-2" },
  ];
  const fake = fakeClient({
    conversations: { data: [conversation, second], error: null },
    messages: { data: draftRows, error: null },
  });

  const result = await getConversationInbox(fake.client, second.id);
  assert.deepEqual(result.data?.pendingDraftCounts, {
    "conversation-1": 1,
    "conversation-2": 2,
  });

  const draftQuery = fake.queries.find((entry) => entry.query.calls.some((call) => call.method === "in"));
  assert.ok(draftQuery, "expected a pending-draft count query");
  const methods = draftQuery.query.calls.map((call) => call.method);
  assert.ok(methods.includes("eq"), "draft query must scope to outbound and draft_blocked");
  assert.ok(methods.includes("in"), "draft query must scope to the owner's conversation ids");
});

test("maskWhatsAppId hides all but the final four digits", () => {
  assert.equal(maskWhatsAppId("15551234567"), "•••• 4567");
  assert.equal(maskWhatsAppId("1234"), "1234");
});

test("maskOpaqueId reveals only the tail of a provider message id", () => {
  assert.equal(maskOpaqueId("wamid.HBgBMTU1NTEyMzQ1NjcVAgokMzk4QTU"), "…kMzk4QTU");
  assert.equal(maskOpaqueId("wamid.12345678901234"), "…78901234");
  assert.equal(maskOpaqueId("wamid.abcdefgh"), "wamid.abcdefgh");
  assert.equal(maskOpaqueId("short"), "short");
});

test("outboundStatusLabel maps delivery states to human labels", () => {
  assert.equal(outboundStatusLabel("sent"), "Sent");
  assert.equal(outboundStatusLabel("delivered"), "Delivered");
  assert.equal(outboundStatusLabel("read"), "Read");
  assert.equal(outboundStatusLabel("failed"), "Failed to send");
  assert.equal(outboundStatusLabel("draft_blocked"), "draft_blocked");
  assert.equal(outboundStatusLabel("weird"), "weird");
});

test("getConversationInbox surfaces the failure reason on failed outbound messages", async () => {
  const failedOutbound: ConversationMessage = {
    ...message,
    id: "message-failed",
    direction: "outbound",
    status: "failed",
    failure_reason: "Re-engagement conversation",
  };
  const fake = fakeClient({
    conversations: { data: [conversation], error: null },
    messages: { data: [failedOutbound], error: null },
  });
  const result = await getConversationInbox(fake.client, conversation.id);
  assert.equal(result.data?.messages[0]?.status, "failed");
  assert.equal(result.data?.messages[0]?.failure_reason, "Re-engagement conversation");
});

test("parseConversationTriageFilter accepts only known filters and defaults to all", () => {
  assert.equal(parseConversationTriageFilter("drafts"), "drafts");
  assert.equal(parseConversationTriageFilter("flagged"), "flagged");
  assert.equal(parseConversationTriageFilter("all"), "all");
  assert.equal(parseConversationTriageFilter(undefined), "all");
  assert.equal(parseConversationTriageFilter("draft"), "all");
  assert.equal(parseConversationTriageFilter(42), "all");
  assert.equal(parseConversationTriageFilter("flagged; drop table"), "all");
});

test("parseCustomerSearchValue keeps only digits and defaults to null", () => {
  assert.equal(parseCustomerSearchValue("+1 (555) 123-4567"), "15551234567");
  assert.equal(parseCustomerSearchValue("91-98765-43210"), "919876543210");
  assert.equal(parseCustomerSearchValue(undefined), null);
  assert.equal(parseCustomerSearchValue(""), null);
  assert.equal(parseCustomerSearchValue("abc!@#"), null);
  assert.equal(parseCustomerSearchValue("palindrome; drop"), null);
});

test("customerWaIdMatches matches any substring of digits", () => {
  assert.equal(customerWaIdMatches("15551234567", "55512"), true);
  assert.equal(customerWaIdMatches("15551234567", "15551234567"), true);
  assert.equal(customerWaIdMatches("15551234567", "999"), false);
  assert.equal(customerWaIdMatches("15551234567", null), true);
  assert.equal(customerWaIdMatches("15551234567", ""), true);
});

function makeMessages(directions: string[]): ConversationMessage[] {
  return directions.map((direction, index) => ({
    ...message,
    id: `message-${index + 1}`,
    direction: direction as "inbound" | "outbound",
    status: direction === "inbound" ? "received" : ("draft_blocked" as const),
  }));
}

test("countPriorInboundTurns measures the memory an AI draft was drafted against", () => {
  const messages = makeMessages(["inbound", "inbound", "outbound", "inbound", "outbound"]);
  assert.equal(countPriorInboundTurns(messages, 2), 2);
  assert.equal(countPriorInboundTurns(messages, 4), 3);
  assert.equal(countPriorInboundTurns(messages, 0), 0);
});

test("countPriorInboundTurns ignores outbound messages and bounds the index", () => {
  const messages = makeMessages(["outbound", "inbound", "outbound"]);
  assert.equal(countPriorInboundTurns(messages, 1), 0);
  assert.equal(countPriorInboundTurns(messages, 3), 1);
  assert.equal(countPriorInboundTurns(messages, 99), 1);
  assert.equal(countPriorInboundTurns([], 0), 0);
});

test("priorInboundTurnsBefore returns the concrete prior customer turns in order", () => {
  const messages = makeMessages(["inbound", "inbound", "outbound", "inbound"]);
  const turns = priorInboundTurnsBefore(messages, 2);
  assert.deepEqual(turns.map((turn) => turn.id), ["message-1", "message-2"]);
  assert.deepEqual(turns.map((turn) => turn.direction), ["inbound", "inbound"]);
});

test("priorInboundTurnsBefore bounds the index and omits outbound messages", () => {
  const messages = makeMessages(["outbound", "inbound", "outbound", "inbound"]);
  assert.deepEqual(priorInboundTurnsBefore(messages, 1), []);
  assert.deepEqual(priorInboundTurnsBefore(messages, 99).map((turn) => turn.id), [
    "message-2",
    "message-4",
  ]);
  assert.deepEqual(priorInboundTurnsBefore([], 0), []);
});

test("lastInboundMessageAt returns the newest inbound timestamp and ignores outbound", () => {
  const messages: ConversationMessage[] = [
    { ...message, id: "early-inbound", direction: "inbound", status: "received" as const, created_at: "2026-09-04T10:00:00.000Z" },
    { ...message, id: "outbound-draft", direction: "outbound", status: "draft_blocked" as const, created_at: "2026-09-05T08:00:00.000Z" },
    { ...message, id: "late-inbound", direction: "inbound", status: "received" as const, created_at: "2026-09-05T09:00:00.000Z" },
  ];
  assert.equal(lastInboundMessageAt(messages), "2026-09-05T09:00:00.000Z");
  assert.equal(lastInboundMessageAt(messages.slice(0, 2)), "2026-09-04T10:00:00.000Z");
  assert.equal(
    lastInboundMessageAt([{ ...message, id: "only-outbound", direction: "outbound", status: "draft_blocked" as const, created_at: "2026-09-05T08:00:00.000Z" }]),
    null,
  );
  assert.equal(lastInboundMessageAt([]), null);
});

test("serviceWindowRemainingMs reports time until close and nulls once the window closes", () => {
  const now = Date.parse("2026-09-05T10:00:00.000Z");
  assert.equal(
    serviceWindowRemainingMs("2026-09-05T09:30:00.000Z", now),
    24 * 60 * 60 * 1_000 - 30 * 60 * 1_000,
  );
  assert.equal(
    serviceWindowRemainingMs("2026-09-05T10:00:00.000Z", now),
    24 * 60 * 60 * 1_000,
  );
  assert.equal(serviceWindowRemainingMs("2026-09-04T10:00:00.000Z", now), null);
  assert.equal(serviceWindowRemainingMs("2026-08-31T00:00:00.000Z", now), null);
  assert.equal(serviceWindowRemainingMs(null, now), null);
  assert.equal(serviceWindowRemainingMs("not-a-date", now), null);
});

test("formatWindowRemaining renders human-readable durations", () => {
  assert.equal(formatWindowRemaining(23.5 * 60 * 60 * 1_000), "23h 30m");
  assert.equal(formatWindowRemaining(2 * 60 * 60 * 1_000 + 4 * 60 * 1_000), "2h 04m");
  assert.equal(formatWindowRemaining(37 * 60 * 1_000), "37m");
  assert.equal(formatWindowRemaining(20 * 1_000), "0m");
  assert.equal(formatWindowRemaining(0), "0m");
});

function buildConversation(
  overrides: Partial<Conversation>,
): Conversation {
  return { ...conversation, ...overrides };
}

test("explainMissingDraft reports no reasons when the latest turn is not inbound or is answered", () => {
  const answered = buildConversation({ id: "conversation-1" });
  assert.deepEqual(
    explainMissingDraft({
      conversation: answered,
      messages: makeMessages(["inbound", "outbound"]),
      pendingDraftCounts: { "conversation-1": 1 },
    }),
    [],
  );
  assert.deepEqual(
    explainMissingDraft({
      conversation: answered,
      messages: makeMessages(["outbound"]),
      pendingDraftCounts: {},
    }),
    [],
  );
  assert.deepEqual(
    explainMissingDraft({
      conversation: null,
      messages: makeMessages(["inbound"]),
      pendingDraftCounts: {},
    }),
    [],
  );
  assert.deepEqual(
    explainMissingDraft({ conversation: answered, messages: [], pendingDraftCounts: {} }),
    [],
  );
});

test("explainMissingDraft surfaces safety gates that block a new draft", () => {
  assert.deepEqual(
    explainMissingDraft({
      conversation: buildConversation({ customer_opted_out_at: "2026-08-24T13:00:00Z" }),
      messages: makeMessages(["inbound"]),
      pendingDraftCounts: {},
    }),
    [{ code: "customer_opted_out", summary: "This customer has opted out of messages. AI drafts stay blocked." }],
  );

  assert.deepEqual(
    explainMissingDraft({
      conversation: buildConversation({ automation_mode: "human", human_takeover_at: "2026-08-24T13:00:00Z" }),
      messages: makeMessages(["inbound"]),
      pendingDraftCounts: {},
    }),
    [{ code: "human_takeover", summary: "Human takeover is active for this conversation, so AI draft generation is paused." }],
  );
});

test("explainMissingDraft reports when no AI employee is assigned", () => {
  assert.deepEqual(
    explainMissingDraft({
      conversation: buildConversation({ ai_employee_id: null }),
      messages: makeMessages(["inbound"]),
      pendingDraftCounts: {},
    }),
    [{ code: "no_employee_assigned", summary: "No AI employee is assigned to this conversation, so no draft is generated for inbound messages." }],
  );
});

test("explainMissingDraft falls back to a neutral note when no gate applies", () => {
  assert.deepEqual(
    explainMissingDraft({
      conversation: buildConversation({ ai_employee_id: "employee-1" }),
      messages: makeMessages(["inbound"]),
      pendingDraftCounts: {},
    }),
    [{ code: "no_outbound_pending", summary: "No AI draft has been generated for the latest customer message yet." }],
  );
});

test("conversationSafetyIndicator surfaces the highest-priority safety state", () => {
  const base = { ai_employee_id: "employee-1", human_takeover_at: null, customer_opted_out_at: null };
  assert.equal(conversationSafetyIndicator({ ...base, automation_mode: "ai" }), null);

  assert.deepEqual(
    conversationSafetyIndicator({ ...base, automation_mode: "ai", customer_opted_out_at: "2026-08-24T13:00:00Z" }),
    { code: "opted_out", label: "Opted out", tone: "danger" },
  );

  assert.deepEqual(
    conversationSafetyIndicator({ ...base, automation_mode: "human" }),
    { code: "human_takeover", label: "Human takeover", tone: "warning" },
  );
  assert.deepEqual(
    conversationSafetyIndicator({ ...base, automation_mode: "ai", human_takeover_at: "2026-08-24T13:00:00Z" }),
    { code: "human_takeover", label: "Human takeover", tone: "warning" },
  );

  assert.deepEqual(
    conversationSafetyIndicator({ ...base, ai_employee_id: null, automation_mode: "ai" }),
    { code: "unassigned", label: "No AI employee", tone: "muted" },
  );

  assert.deepEqual(
    conversationSafetyIndicator({
      ai_employee_id: null,
      automation_mode: "human",
      human_takeover_at: "2026-08-24T13:00:00Z",
      customer_opted_out_at: "2026-08-24T13:00:00Z",
    }),
    { code: "opted_out", label: "Opted out", tone: "danger" },
  );
});
