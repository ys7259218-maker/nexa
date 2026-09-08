import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONVERSATIONS_LIST_LIMIT,
  INBOX_MESSAGES_LIMIT,
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

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number;
};

class FakeQuery {
  calls: Array<{ method: string; args: unknown }> = [];
  private readonly table: string;
  private readonly results: Record<string, QueryResult>;
  private byId = false;
  private head = false;

  constructor(table: string, results: Record<string, QueryResult>) {
    this.table = table;
    this.results = results;
  }

  select(args?: unknown, options?: { count?: string; head?: boolean }) {
    if (options?.head) this.head = true;
    this.calls.push({ method: "select", args: options?.head ? { args, options } : args });
    return this;
  }

  order(column: string, options?: unknown) {
    this.calls.push({ method: "order", args: { column, options } });
    return this;
  }

  limit(count: number) {
    this.calls.push({ method: "limit", args: { count } });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: "maybeSingle", args: undefined });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.calls.push({ method: "ilike", args: { column, value } });
    return this;
  }

  eq(column: string, value: unknown) {
    this.calls.push({ method: "eq", args: { column, value } });
    if (column === "id") this.byId = true;
    return this;
  }

  in(column: string, values: unknown) {
    this.calls.push({ method: "in", args: { column, values } });
    return this;
  }

  then(resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) {
    const countEntry = this.results[`${this.table}:count`];
    const result = this.head
      ? countEntry ?? { data: [], count: undefined, error: null }
      : this.byId
        ? this.results.conversationById ?? { data: null, error: null }
        : this.results[this.table] ?? { data: null, error: null };
    return Promise.resolve(result).then(resolve, reject);
  }
}

function fakeClient(results: Record<string, QueryResult>) {
  const queries: Array<{ table: string; query: FakeQuery }> = [];
  const client = {
    from(table: string) {
      const query = new FakeQuery(table, results);
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
      totalConversations: 1,
      listedConversations: 1,
      conversationsTruncated: false,
      totalMessages: 1,
      messagesTruncated: false,
    },
    error: null,
  });

  assert.deepEqual(fake.queries[0]?.query.calls[1], {
    method: "order",
    args: { column: "last_message_at", options: { ascending: false } },
  });
  assert.deepEqual(fake.queries[0]?.query.calls[2], { method: "limit", args: { count: CONVERSATIONS_LIST_LIMIT } });
  const threadQuery = fake.queries.find((entry) =>
    entry.query.calls.some((call) =>
      call.method === "eq" && JSON.stringify(call.args) === JSON.stringify({ column: "conversation_id", value: conversation.id })
    ),
  );
  assert.ok(threadQuery, "thread fetch must scope to the selected conversation");
  assert.ok(threadQuery?.query.calls.some((call) =>
    call.method === "order" &&
    JSON.stringify(call.args) === JSON.stringify({ column: "created_at", options: { ascending: false } })
  ), "thread fetch must keep the newest messages first");
  assert.ok(threadQuery?.query.calls.some((call) =>
    call.method === "limit" && JSON.stringify(call.args) === JSON.stringify({ count: INBOX_MESSAGES_LIMIT })
  ), "thread fetch must be bounded");
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
    data: {
      conversations: [],
      selectedConversation: null,
      messages: [],
      pendingDraftCounts: {},
      totalConversations: 0,
      listedConversations: 0,
      conversationsTruncated: false,
      totalMessages: 0,
      messagesTruncated: false,
    },
    error: null,
  });
  assert.equal(empty.queries.length, 2, "the list and its exact-count query run together");
});

test("getConversationInbox does not query messages for an unknown requested id", async () => {
  const fake = fakeClient({
    conversations: { data: [conversation], error: null },
    conversationById: { data: null, error: null },
  });
  const result = await getConversationInbox(fake.client, "not-owned-or-missing");
  assert.equal(result.data?.selectedConversation, null);
  assert.ok(fake.queries.some((entry) =>
    entry.query.calls.some((call) => call.method === "maybeSingle")
  ), "an unknown deep-link id is looked up by id so the list cap cannot hide it");
  assert.equal(
    fake.queries.filter((entry) =>
      entry.query.calls.some((call) => call.method === "eq" && (call.args as { column: string })?.column === "conversation_id")
    ).length,
    0,
    "no thread query runs when no conversation is selected",
  );
});

test("getConversationInbox searches the database when a customer query is provided", async () => {
  const match = { ...conversation, id: "conversation-match" };
  const nonMatch = { ...conversation, id: "conversation-other" };
  const fake = fakeClient({
    conversations: { data: [match, nonMatch], error: null },
    messages: { data: [message], error: null },
  });

  const result = await getConversationInbox(fake.client, match.id, "5551234");
  assert.equal(result.error, null);
  assert.equal(result.data?.selectedConversation?.id, "conversation-match");

  const listQuery = fake.queries[0]?.query;
  assert.ok(listQuery?.calls.some((call) =>
    call.method === "ilike" &&
    JSON.stringify(call.args) === JSON.stringify({ column: "customer_wa_id", value: "%5551234%" })
  ), "search runs a database ilike on the raw customer number");
  assert.ok(listQuery?.calls.some((call) => call.method === "limit"), "search results are still bounded");
});

test("getConversationInbox does not search the database without a customer query", async () => {
  const fake = fakeClient({
    conversations: { data: [conversation], error: null },
    messages: { data: [message], error: null },
  });

  await getConversationInbox(fake.client, conversation.id);
  const listQuery = fake.queries[0]?.query;
  assert.ok(
    !listQuery?.calls.some((call) => call.method === "ilike"),
    "the default inbox list is newest-first, not a search",
  );
  assert.deepEqual(listQuery?.calls[0], { method: "select", args: "*" });
  assert.deepEqual(listQuery?.calls[1]?.method, "order");
});

test("getConversationInbox loads a deep-linked conversation beyond the list cap by id", async () => {
  const deep = { ...conversation, id: "conversation-deep", last_message_at: "2026-08-01T00:00:00Z" };
  const deepHistory = [
    { ...message, id: "deep-2", created_at: "2026-08-01T09:00:00Z" },
    { ...message, id: "deep-1", created_at: "2026-08-01T08:00:00Z" },
  ];
  const fake = fakeClient({
    conversations: { data: [conversation], error: null },
    conversationById: { data: deep, error: null },
    messages: { data: deepHistory, error: null },
  });

  const result = await getConversationInbox(fake.client, deep.id);
  assert.equal(result.error, null);
  assert.equal(result.data?.selectedConversation?.id, deep.id);
  assert.equal(result.data?.conversations.length, 2, "the deep-linked conversation is appended to the list view");
  assert.deepEqual(result.data?.messages.map((m) => m.id), ["deep-1", "deep-2"], "thread is reversed back to chronological order");

  const direct = fake.queries.filter((entry) =>
    entry.query.calls.some((call) => call.method === "maybeSingle")
  );
  assert.equal(direct.length, 1, "the deep-link triggers exactly one by-id lookup");
});

test("getConversationInbox exposes the exact conversation and message totals with truncation flags", async () => {
  const fake = fakeClient({
    conversations: { data: [conversation], error: null },
    "conversations:count": { data: [], count: 250, error: null },
    messages: { data: [message], error: null },
    "messages:count": { data: [], count: 400, error: null },
  });

  const result = await getConversationInbox(fake.client, conversation.id);
  assert.equal(result.error, null);
  assert.equal(result.data?.totalConversations, 250, "total comes from the exact head count, not the returned rows");
  assert.equal(result.data?.listedConversations, 1);
  assert.equal(result.data?.conversationsTruncated, true);
  assert.equal(result.data?.totalMessages, 400, "the 300-message thread cap is not a silent data loss");
  assert.equal(result.data?.messagesTruncated, true);
});

test('getConversationInbox keeps the "newest M" count truthful when a deep link appends an older chat', async () => {
  const deep = { ...conversation, id: "conversation-deep", last_message_at: "2026-08-01T00:00:00Z" };
  const fake = fakeClient({
    conversations: { data: [conversation], error: null },
    "conversations:count": { data: [], count: 500, error: null },
    conversationById: { data: deep, error: null },
    messages: { data: [], error: null },
  });

  const result = await getConversationInbox(fake.client, deep.id);
  assert.equal(result.data?.conversations.length, 2, "deep-linked chat is appended for display");
  assert.equal(result.data?.listedConversations, 1, "the listed count excludes the appended deep link");
  assert.equal(result.data?.conversationsTruncated, true);
  assert.equal(result.data?.totalConversations, 500);
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
