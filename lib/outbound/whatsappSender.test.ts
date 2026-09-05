import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTemplatePayload,
  buildTextPayload,
  createRateLimiter,
  isOutboundSendReady,
  isTransient,
  parseOutboundConfig,
  sendTemplateMessage,
  sendTextMessage,
  type FetchLike,
  type OutboundSenderConfig,
} from "./whatsappSender.ts";
import {
  describeSendFailure,
  isValidDraftMessageId,
  sendApprovedDraft,
} from "../server/draftSender.ts";

function readyConfig(overrides: Partial<OutboundSenderConfig> = {}): OutboundSenderConfig {
  return {
    enabled: true,
    accessToken: "test-token",
    phoneNumberId: "123456789",
    graphVersion: "v25.0",
    maxBodyLength: 4000,
    maxAttempts: 3,
    backoffMs: 1,
    rateLimitWindowMs: 60000,
    rateLimitMax: 20,
    ...overrides,
  };
}

type FetchResult = { ok: boolean; status: number; json(): Promise<unknown> };

function makeFetch() {
  const state: { calls: Array<{ url: string; init: unknown }>; impl: ((url: string, init: unknown) => Promise<FetchResult>) | null } = {
    calls: [],
    impl: null,
  };
  const fetchImpl: FetchLike = (url, init) => {
    state.calls.push({ url, init });
    if (!state.impl) throw new Error("no fetch impl configured");
    return state.impl(url, init);
  };
  return {
    fetchImpl,
    calls: state.calls,
    set impl(value: (url: string, init: unknown) => Promise<FetchResult>) {
      state.impl = value;
    },
  };
}

const ok = (wamid = "wamid.ABC"): Promise<FetchResult> =>
  Promise.resolve({ ok: true, status: 200, json: async () => ({ messages: [{ id: wamid }] }) });

const noopSleep = async () => {};

test("parseOutboundConfig fails closed without flag, token, or phone id", () => {
  const base = { WHATSAPP_OUTBOUND_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "p" };
  assert.equal(isOutboundSendReady(parseOutboundConfig(base)), true);
  assert.equal(isOutboundSendReady(parseOutboundConfig({ ...base, WHATSAPP_OUTBOUND_ENABLED: "false" })), false);
  assert.equal(isOutboundSendReady(parseOutboundConfig({ ...base, WHATSAPP_ACCESS_TOKEN: "" })), false);
  assert.equal(isOutboundSendReady(parseOutboundConfig({ ...base, WHATSAPP_PHONE_NUMBER_ID: "" })), false);
});

test("isOutboundSendReady requires flag, token, and phone id together", () => {
  assert.equal(isOutboundSendReady(readyConfig({ enabled: false })), false);
  assert.equal(isOutboundSendReady(readyConfig({ accessToken: "" })), false);
  assert.equal(isOutboundSendReady(readyConfig({ phoneNumberId: "" })), false);
  assert.equal(isOutboundSendReady(readyConfig()), true);
});

test("sendTextMessage returns not_ready without calling fetch", async () => {
  const f = makeFetch();
  const outcome = await sendTextMessage({
    config: readyConfig({ enabled: false }),
    to: "15551234567",
    body: "hello",
    fetchImpl: f.fetchImpl,
  });
  assert.equal(outcome.kind, "not_ready");
  assert.equal(f.calls.length, 0);
});

test("sendTextMessage rejects invalid recipients and empty bodies before fetch", async () => {
  const badReceiver = await sendTextMessage({
    config: readyConfig(),
    to: "+15551234567",
    body: "hi",
    fetchImpl: makeFetch().fetchImpl,
  });
  assert.deepEqual(badReceiver, { kind: "invalid", reason: "invalid_recipient" });

  const badBody = await sendTextMessage({
    config: readyConfig(),
    to: "15551234567",
    body: "   ",
    fetchImpl: makeFetch().fetchImpl,
  });
  assert.deepEqual(badBody, { kind: "invalid", reason: "empty_body" });
});

test("sendTextMessage sends to the pinned Graph endpoint with Bearer auth and returns wamid", async () => {
  const f = makeFetch();
  f.impl = async (url, init) => {
    assert.equal(url, "https://graph.facebook.com/v25.0/123456789/messages");
    const headers = (init as { headers: Record<string, string> }).headers;
    assert.equal(headers.Authorization, "Bearer test-token");
    assert.equal(headers["Content-Type"], "application/json");
    const sent = JSON.parse((init as { body: string }).body);
    assert.equal(sent.messaging_product, "whatsapp");
    assert.equal(sent.to, "15551234567");
    assert.equal(sent.type, "text");
    return ok();
  };

  const outcome = await sendTextMessage({
    config: readyConfig(),
    to: "15551234567",
    body: "hello there",
    fetchImpl: f.fetchImpl,
  });
  assert.deepEqual(outcome, { kind: "sent", wamid: "wamid.ABC" });
});

test("sendTextMessage retries transient failures then succeeds", async () => {
  const f = makeFetch();
  let attemptsCalled = 0;
  f.impl = async () => {
    attemptsCalled += 1;
    if (attemptsCalled === 1) {
      return { ok: false, status: 500, json: async () => ({ error: { code: 1 } }) };
    }
    return ok("wamid.2");
  };

  const outcome = await sendTextMessage({
    config: readyConfig({ maxAttempts: 3, backoffMs: 0 }),
    to: "15551234567",
    body: "retry",
    fetchImpl: f.fetchImpl,
    sleep: noopSleep,
  });
  assert.deepEqual(outcome, { kind: "sent", wamid: "wamid.2" });
  assert.equal(attemptsCalled, 2);
});

test("sendTextMessage fails on non-transient errors without multiple attempts", async () => {
  const f = makeFetch();
  let attemptsCalled = 0;
  f.impl = async () => {
    attemptsCalled += 1;
    return { ok: false, status: 400, json: async () => ({ error: { code: 100 } }) };
  };

  const outcome = await sendTextMessage({
    config: readyConfig({ maxAttempts: 3 }),
    to: "15551234567",
    body: "nope",
    fetchImpl: f.fetchImpl,
    sleep: noopSleep,
  });
  assert.equal(outcome.kind, "error");
  assert.equal(attemptsCalled, 1);
});

test("sendTextMessage returns error after exhausting retries on network failure", async () => {
  const f = makeFetch();
  f.impl = async () => {
    throw new Error("socket hang up");
  };

  const outcome = await sendTextMessage({
    config: readyConfig({ maxAttempts: 3, backoffMs: 0 }),
    to: "15551234567",
    body: "x",
    fetchImpl: f.fetchImpl,
    sleep: noopSleep,
  });
  assert.equal(outcome.kind, "error");
});

test("sendTextMessage respects the rate limiter and does not fetch when limited", async () => {
  const f = makeFetch();
  f.impl = async () => ok();
  const limiter = createRateLimiter(60000, 1);
  assert.equal(limiter.tryAcquire("123456789"), true);
  assert.equal(limiter.tryAcquire("123456789"), false);

  const outcome = await sendTextMessage({
    config: readyConfig(),
    to: "15551234567",
    body: "hi",
    fetchImpl: f.fetchImpl,
    rateLimiter: limiter,
  });
  assert.deepEqual(outcome, { kind: "rate_limited" });
  assert.equal(f.calls.length, 0);

  const okSecond = await sendTextMessage({
    config: readyConfig({ phoneNumberId: "other" }),
    to: "15551234567",
    body: "hi",
    fetchImpl: f.fetchImpl,
    rateLimiter: limiter,
  });
  assert.equal(okSecond.kind, "sent");
});

test("buildTextPayload truncates body to the bounded maximum", () => {
  const payload = buildTextPayload({ to: "15551234567", body: "a".repeat(100), maxBodyLength: 10 });
  assert.equal(payload.text.body.length, 10);
  assert.equal(payload.recipient_type, "individual");
  assert.equal(payload.text.preview_url, false);
});

test("isTransient classifies 5xx, 429, and Meta rate codes", () => {
  assert.equal(isTransient(500, {}), true);
  assert.equal(isTransient(503, {}), true);
  assert.equal(isTransient(429, {}), true);
  assert.equal(isTransient(400, { error: { code: 100 } }), false);
  assert.equal(isTransient(400, { error: { code: 80007 } }), true);
  assert.equal(isTransient(400, { error: { code: 131056 } }), true);
});

test("createRateLimiter limits within a window and allows after it elapses", async () => {
  const windowMs = 25;
  const limiter = createRateLimiter(windowMs, 1);
  assert.equal(limiter.tryAcquire("k"), true);
  assert.equal(limiter.tryAcquire("k"), false);
  await new Promise((r) => setTimeout(r, windowMs + 20));
  assert.equal(limiter.tryAcquire("k"), true);
});

test("buildTemplatePayload builds a bounded Meta template payload", () => {
  const payload = buildTemplatePayload({
    to: "15551234567",
    name: "order_update",
    language: "en_US",
    componentParams: ["hello", "world"],
  });
  assert.equal(payload.type, "template");
  assert.equal(payload.messaging_product, "whatsapp");
  assert.equal(payload.template.name, "order_update");
  assert.deepEqual(payload.template.language, { code: "en_US" });
  assert.deepEqual(payload.template.components, [
    { type: "body", parameters: [{ type: "text", text: "hello" }, { type: "text", text: "world" }] },
  ]);
});

test("buildTemplatePayload omits components when no params are given", () => {
  const payload = buildTemplatePayload({
    to: "15551234567",
    name: "no_params",
    language: "en",
  });
  assert.deepEqual(payload.template.components, []);
});

test("sendTemplateMessage returns not_ready without fetching when gated off", async () => {
  const f = makeFetch();
  const outcome = await sendTemplateMessage({
    config: readyConfig({ enabled: false }),
    to: "15551234567",
    name: "welcome",
    language: "en",
    fetchImpl: f.fetchImpl,
  });
  assert.equal(outcome.kind, "not_ready");
  assert.equal(f.calls.length, 0);
});

test("sendTemplateMessage rejects an invalid template before fetching", async () => {
  const f = makeFetch();
  const outcome = await sendTemplateMessage({
    config: readyConfig(),
    to: "15551234567",
    name: "has space",
    language: "en",
    fetchImpl: f.fetchImpl,
  });
  assert.deepEqual(outcome, { kind: "invalid", reason: "invalid_template_name" });
  assert.equal(f.calls.length, 0);
});

test("sendTemplateMessage rejects an invalid recipient before fetching", async () => {
  const f = makeFetch();
  const outcome = await sendTemplateMessage({
    config: readyConfig(),
    to: "",
    name: "welcome",
    language: "en",
    fetchImpl: f.fetchImpl,
  });
  assert.deepEqual(outcome, { kind: "invalid", reason: "empty_recipient" });
  assert.equal(f.calls.length, 0);
});

test("sendTemplateMessage sends a template payload and returns wamid", async () => {
  const f = makeFetch();
  f.impl = async (url, init) => {
    assert.equal(url, "https://graph.facebook.com/v25.0/123456789/messages");
    const sent = JSON.parse((init as { body: string }).body);
    assert.equal(sent.type, "template");
    assert.equal(sent.template.name, "welcome");
    assert.deepEqual(sent.template.language, { code: "en_US" });
    return ok("wamid.TPL");
  };

  const outcome = await sendTemplateMessage({
    config: readyConfig(),
    to: "15551234567",
    name: "welcome",
    language: "en_US",
    fetchImpl: f.fetchImpl,
  });
  assert.deepEqual(outcome, { kind: "sent", wamid: "wamid.TPL" });
});

import type { SupabaseClient } from "@supabase/supabase-js";

const draftOwnerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draftOtherOwnerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const draftMessageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const draftConversationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type Row = Record<string, unknown>;

function draftMessage(overrides: Partial<Row> = {}): Row {
  return {
    id: draftMessageId,
    user_id: draftOwnerId,
    conversation_id: draftConversationId,
    direction: "outbound",
    status: "draft_blocked",
    body: "Hello, here is your update.",
    ...overrides,
  };
}

function draftConversation(overrides: Partial<Row> = {}): Row {
  return {
    id: draftConversationId,
    user_id: draftOwnerId,
    customer_wa_id: "15551234567",
    automation_mode: "auto",
    customer_opted_out_at: null,
    human_takeover_at: null,
    ...overrides,
  };
}

class FakeDraftService {
  messageError = false;
  conversationError = false;
  updateError = false;
  appliedUpdate: Row | null = null;
  sentCalls: Array<{ to: string; body: string }> = [];
  readonly message: Row | null;
  readonly conversation: Row | null;

  constructor(message: Row | null, conversation: Row | null) {
    this.message = message;
    this.conversation = conversation;
  }

  from(table: "messages" | "conversations"): FakeDraftQuery {
    return new FakeDraftQuery(this, table);
  }
}

class FakeDraftQuery {
  private readonly service: FakeDraftService;
  private readonly table: "messages" | "conversations";

  constructor(service: FakeDraftService, table: "messages" | "conversations") {
    this.service = service;
    this.table = table;
  }

  select(): FakeDraftQuery {
    return this;
  }

  eq(): FakeDraftQuery {
    return this;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }> {
    if (this.table === "messages") {
      if (this.service.messageError) return { data: null, error: { message: "read failed" } };
      return { data: this.service.message, error: null };
    }
    if (this.service.conversationError) return { data: null, error: { message: "read failed" } };
    return { data: this.service.conversation, error: null };
  }

  update(patch: Row): FakeDraftUpdate {
    return new FakeDraftUpdate(this.service, patch);
  }
}

class FakeDraftUpdate {
  private readonly service: FakeDraftService;
  private readonly patch: Row;

  constructor(service: FakeDraftService, patch: Row) {
    this.service = service;
    this.patch = patch;
  }

  eq(): { error: { message: string } | null } {
    if (this.service.updateError) return { error: { message: "update failed" } };
    this.service.appliedUpdate = this.patch;
    return { error: null };
  }
}

function draftService(
  message: Row | null,
  conversation: Row | null,
): { service: SupabaseClient; fake: FakeDraftService } {
  const fake = new FakeDraftService(message, conversation);
  return { service: fake as unknown as SupabaseClient, fake };
}

test("isValidDraftMessageId accepts a UUID and rejects garbage", () => {
  assert.equal(isValidDraftMessageId(draftMessageId), true);
  assert.equal(isValidDraftMessageId("nope"), false);
  assert.equal(isValidDraftMessageId(42), false);
});

test("sendApprovedDraft fails closed when the message is missing", async () => {
  const { service, fake } = draftService(null, draftConversation());
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.deepEqual(outcome, { ok: false, code: "not_found", message: "Message not found." });
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft hides other users' messages and never sends", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  const outcome = await sendApprovedDraft(service, draftOtherOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_found");
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft rejects a message that is not a pending draft", async () => {
  const { service, fake } = draftService(
    draftMessage({ status: "received", direction: "inbound" }),
    draftConversation(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.deepEqual(outcome, {
    ok: false,
    code: "not_draft",
    message: "This message is not a pending draft.",
  });
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft refuses to contact opted-out customers", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation({ customer_opted_out_at: "2026-08-29T07:30:00.000Z" }),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_allowed");
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft refuses sends under human takeover", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation({ automation_mode: "human", human_takeover_at: "2026-08-29T07:30:00.000Z" }),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_allowed");
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft rejects a stored number that is not E.164", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation({ customer_wa_id: "call me 555" }),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "invalid_recipient");
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft surfaces sender failure and records no status", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    send: async () => ({ kind: "error" }),
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "send_failed");
  assert.match(describeSendFailure({ kind: "error" }), /did not accept/);
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft reports persist_failed when the status cannot be stored", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  fake.updateError = true;
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    send: async () => ({ kind: "sent", wamid: "wamid.APPROVED" }),
  });
  assert.deepEqual(outcome, {
    ok: false,
    code: "persist_failed",
    message: "The draft was sent, but its delivery status could not be recorded here.",
  });
});

test("sendApprovedDraft sends the draft and records sent status with the wamid", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    send: async (to, body) => {
      fake.sentCalls.push({ to, body });
      return { kind: "sent", wamid: "wamid.APPROVED" };
    },
  });
  assert.deepEqual(outcome, { ok: true, wamid: "wamid.APPROVED" });
  assert.deepEqual(fake.sentCalls, [{ to: "15551234567", body: "Hello, here is your update." }]);
  assert.equal(fake.appliedUpdate?.status, "sent");
  assert.equal(fake.appliedUpdate?.wa_message_id, "wamid.APPROVED");
  assert.equal(typeof fake.appliedUpdate?.sent_at, "string");
});
