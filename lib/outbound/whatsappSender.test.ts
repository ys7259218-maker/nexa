import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTemplatePayload,
  buildTextPayload,
  createRateLimiter,
  describeOutboundReadiness,
  isOutboundSendReady,
  isTransient,
  parseOutboundConfig,
  resolveOutboundTransportReady,
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
import {
  claimOutboundMessageSend,
  finalizeOutboundMessageSend,
  releaseOutboundMessageSend,
} from "../server/outboundClaim.ts";

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

test("resolveOutboundTransportReady locks activation unless flag, token, and phone id are all present", () => {
  const base = {
    WHATSAPP_OUTBOUND_ENABLED: "true",
    WHATSAPP_ACCESS_TOKEN: "t",
    WHATSAPP_PHONE_NUMBER_ID: "p",
  };
  assert.equal(resolveOutboundTransportReady(base), true);
  assert.equal(resolveOutboundTransportReady({ ...base, WHATSAPP_OUTBOUND_ENABLED: "false" }), false);
  assert.equal(resolveOutboundTransportReady({ ...base, WHATSAPP_ACCESS_TOKEN: "" }), false);
  assert.equal(resolveOutboundTransportReady({ ...base, WHATSAPP_ACCESS_TOKEN: undefined }), false);
  assert.equal(resolveOutboundTransportReady({ ...base, WHATSAPP_PHONE_NUMBER_ID: "" }), false);
  assert.equal(resolveOutboundTransportReady({ ...base, WHATSAPP_PHONE_NUMBER_ID: undefined }), false);
});

test("describeOutboundReadiness breaks down each requirement without leaking secrets", () => {
  const items = describeOutboundReadiness(
    readyConfig({ enabled: false, accessToken: "super-secret-token", phoneNumberId: "12345" }),
  );
  const byKey = new Map(items.map((item) => [item.key, item]));
  assert.equal(byKey.get("enabled")?.ready, false);
  assert.equal(byKey.get("access_token")?.ready, true);
  assert.match(byKey.get("access_token")?.detail ?? "", /non-empty access token/);
  assert.equal(byKey.get("phone_number_id")?.ready, true);
  assert.equal(items.some((item) => item.detail.includes("super-secret-token")), false);
  assert.equal(items.some((item) => item.detail.includes("12345")), false);
  assert.equal(byKey.get("graph_version")?.ready, true);
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
  inboundReadError = false;
  updateError = false;
  claimError = false;
  claimDenyReason: string | null = null;
  finalizeMismatch = false;
  releaseError = false;
  appliedUpdate: Row | null = null;
  sentCalls: Array<{ to: string; body: string }> = [];
  finalizeCalls: Array<{ messageId: string; claimToken: string; ownerUserId: string }> = [];
  releaseCalls: Array<{ messageId: string; claimToken: string; ownerUserId: string }> = [];
  readonly registry: Map<string, string>;
  readonly message: Row | null;
  readonly conversation: Row | null;
  readonly lastInbound: Row | null;

  constructor(
    message: Row | null,
    conversation: Row | null,
    lastInbound: Row | null,
    registry: Map<string, string> = new Map(),
  ) {
    this.message = message;
    this.conversation = conversation;
    this.lastInbound = lastInbound;
    this.registry = registry;
  }

  from(table: "messages" | "conversations"): FakeDraftQuery {
    return new FakeDraftQuery(this, table);
  }

  async rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }> {
    if (fn === "claim_outbound_message_send") {
      if (this.claimError) return { data: null, error: { message: "rpc failed" } };
      if (this.claimDenyReason) {
        return { data: [{ claim_token: null, reason: this.claimDenyReason }], error: null };
      }
      const messageId = String(args.p_message_id);
      if (this.registry.has(messageId)) {
        return { data: [{ claim_token: null, reason: "already_claimed" }], error: null };
      }
      const token = `claim-${messageId}`;
      this.registry.set(messageId, token);
      return { data: [{ claim_token: token, reason: "claimed" }], error: null };
    }
    if (fn === "finalize_outbound_message_send") {
      const messageId = String(args.p_message_id);
      const claimToken = String(args.p_claim_token);
      this.finalizeCalls.push({
        messageId,
        claimToken,
        ownerUserId: String(args.p_owner_user_id),
      });
      if (this.updateError) return { data: null, error: { message: "update failed" } };
      if (this.finalizeMismatch || this.registry.get(messageId) !== claimToken) {
        return { data: [{ finalized: false, reason: "claim_mismatch" }], error: null };
      }
      this.registry.delete(messageId);
      this.appliedUpdate = {
        status: "sent",
        wa_message_id: args.p_wa_message_id,
        sent_at: args.p_sent_at,
        ...(typeof args.p_template_name === "string" && args.p_template_name
          ? { template_name: args.p_template_name }
          : {}),
      };
      return { data: [{ finalized: true, reason: "finalized" }], error: null };
    }
    if (fn === "release_outbound_message_send") {
      const messageId = String(args.p_message_id);
      const claimToken = String(args.p_claim_token);
      this.releaseCalls.push({
        messageId,
        claimToken,
        ownerUserId: String(args.p_owner_user_id),
      });
      if (this.releaseError) return { data: null, error: { message: "rpc failed" } };
      if (this.registry.get(messageId) === claimToken) {
        this.registry.delete(messageId);
        return { data: [{ released: true, reason: "released" }], error: null };
      }
      return { data: [{ released: false, reason: "claim_mismatch" }], error: null };
    }
    throw new Error(`unexpected rpc ${fn}`);
  }
}

class FakeDraftQuery {
  private readonly service: FakeDraftService;
  private readonly table: "messages" | "conversations";
  private readonly filters: Array<{ column: string; value: unknown }> = [];

  constructor(service: FakeDraftService, table: "messages" | "conversations") {
    this.service = service;
    this.table = table;
  }

  select(): FakeDraftQuery {
    return this;
  }

  eq(column: string, value: unknown): FakeDraftQuery {
    this.filters.push({ column, value });
    return this;
  }

  order(): FakeDraftQuery {
    return this;
  }

  limit(): FakeDraftQuery {
    return this;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }> {
    const targetsInbound = this.filters.some(
      (filter) => filter.column === "direction" && filter.value === "inbound",
    );
    if (this.table === "messages") {
      if (this.service.messageError) return { data: null, error: { message: "read failed" } };
      if (targetsInbound) {
        if (this.service.inboundReadError) return { data: null, error: { message: "read failed" } };
        return { data: this.service.lastInbound, error: null };
      }
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
  lastInbound: Row | null = recentInbound(),
): { service: SupabaseClient; fake: FakeDraftService } {
  const fake = new FakeDraftService(message, conversation, lastInbound);
  return { service: fake as unknown as SupabaseClient, fake };
}

function recentInbound(): Row {
  return { created_at: new Date(Date.now() - 60_000).toISOString() };
}

function staleInbound(): Row {
  return { created_at: new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString() };
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

test("sendApprovedDraft retries a failed free-form message within the window", async () => {
  const { service, fake } = draftService(
    draftMessage({ status: "failed", template_name: null }),
    draftConversation(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    send: async (to, body) => {
      fake.sentCalls.push({ to, body });
      return { kind: "sent", wamid: "wamid.RETRY" };
    },
  });
  assert.deepEqual(outcome, { ok: true, wamid: "wamid.RETRY" });
  assert.deepEqual(fake.sentCalls, [{ to: "15551234567", body: "Hello, here is your update." }]);
  assert.equal(fake.appliedUpdate?.status, "sent");
});

test("sendApprovedDraft blocks auto-retry of a failed template-based message", async () => {
  const { service, fake } = draftService(
    draftMessage({ status: "failed", template_name: "order_confirmed" }),
    draftConversation(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_allowed");
  assert.match((outcome as { message: string }).message, /cannot be auto-retried/);
  assert.equal(fake.sentCalls.length, 0);
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft still rejects an outbound message that is not a draft or failed", async () => {
  const { service } = draftService(
    draftMessage({ status: "sent", template_name: null }),
    draftConversation(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_draft");
});

test("sendApprovedDraft refuses free-form sends outside the 24-hour window", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation(),
    staleInbound(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_allowed");
  assert.match((outcome as { message: string }).message, /24-hour customer-service window/);
  assert.equal(fake.sentCalls.length, 0);
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft fails closed with no inbound record at all", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation(), null);
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_allowed");
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft fails closed when the window cannot be verified", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  fake.inboundReadError = true;
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "window_unverified");
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft sends a validated template once the window has closed", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation(),
    staleInbound(),
  );
  const templateCalls: Array<{ to: string; name: string; language: string }> = [];
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
    templateLanguage: "en_US",
    send: async () => {
      throw new Error("free-form transport must not be used outside the window");
    },
    sendTemplate: async (to, name, language) => {
      templateCalls.push({ to, name, language });
      return { kind: "sent", wamid: "wamid.TEMPLATE" };
    },
  });
  assert.deepEqual(outcome, { ok: true, wamid: "wamid.TEMPLATE" });
  assert.deepEqual(templateCalls, [
    { to: "15551234567", name: "order_confirmed", language: "en_US" },
  ]);
  assert.equal(fake.appliedUpdate?.status, "sent");
  assert.equal(fake.appliedUpdate?.wa_message_id, "wamid.TEMPLATE");
  assert.equal(fake.appliedUpdate?.template_name, "order_confirmed");
});

test("sendApprovedDraft requires a template when there is no inbound record at all", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation(), null);
  const withoutName = await sendApprovedDraft(service, draftOwnerId, draftMessageId);
  assert.equal(withoutName.ok, false);
  assert.equal((withoutName as { code: string }).code, "not_allowed");

  const templateCalls: Array<string> = [];
  const withName = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "welcome_coupon",
    sendTemplate: async (_to, name) => {
      templateCalls.push(name);
      return { kind: "sent", wamid: "wamid.TEMPLATE" };
    },
  });
  assert.deepEqual(withName, { ok: true, wamid: "wamid.TEMPLATE" });
  assert.deepEqual(templateCalls, ["welcome_coupon"]);
  assert.equal(fake.appliedUpdate?.template_name, "welcome_coupon");
});

test("sendApprovedDraft rejects an invalid template reference before calling the transport", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation(),
    staleInbound(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "bad name with spaces",
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "invalid_template");
  assert.match((outcome as { message: string }).message, /invalid/i);
  assert.equal(fake.appliedUpdate, null);
  assert.equal(fake.sentCalls.length, 0);
});

test("sendApprovedDraft surfaces a template transport failure and records nothing", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation(),
    staleInbound(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
    sendTemplate: async () => ({ kind: "error" }),
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "send_failed");
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft prefers free-form while the window is open even if a template is named", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation(), recentInbound());
  const templateCalls: Array<string> = [];
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
    send: async (to, body) => {
      fake.sentCalls.push({ to, body });
      return { kind: "sent", wamid: "wamid.FREEFORM" };
    },
    sendTemplate: async (_to, name) => {
      templateCalls.push(name);
      return { kind: "sent", wamid: "wamid.TEMPLATE" };
    },
  });
  assert.deepEqual(outcome, { ok: true, wamid: "wamid.FREEFORM" });
  assert.equal(templateCalls.length, 0);
  assert.deepEqual(fake.sentCalls, [{ to: "15551234567", body: "Hello, here is your update." }]);
  assert.equal(fake.appliedUpdate?.template_name, undefined);
});

test("sendApprovedDraft uses the template while the window is open when preferTemplate is set", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation(), recentInbound());
  const templateCalls: Array<{ to: string; name: string; language: string }> = [];
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
    templateLanguage: "en",
    preferTemplate: true,
    send: async () => {
      throw new Error("free-form transport must not be used when preferTemplate is set");
    },
    sendTemplate: async (to, name, language) => {
      templateCalls.push({ to, name, language });
      return { kind: "sent", wamid: "wamid.TEMPLATE" };
    },
  });
  assert.deepEqual(outcome, { ok: true, wamid: "wamid.TEMPLATE" });
  assert.deepEqual(templateCalls, [{ to: "15551234567", name: "order_confirmed", language: "en" }]);
  assert.equal(fake.appliedUpdate?.status, "sent");
  assert.equal(fake.appliedUpdate?.template_name, "order_confirmed");
});

test("sendApprovedDraft requires a template name when preferTemplate is set", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation(), recentInbound());
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    preferTemplate: true,
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "not_allowed");
  assert.match((outcome as { message: string }).message, /Choose a template/);
  assert.equal(fake.sentCalls.length, 0);
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft forwards template params to the transport", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation(),
    staleInbound(),
  );
  const templateCalls: Array<{ to: string; name: string; language: string; params?: string[] }> = [];
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
    templateLanguage: "en",
    templateParams: ["#ORD-123", "Mumbai"],
    sendTemplate: async (to, name, language, componentParams) => {
      templateCalls.push({ to, name, language, params: componentParams });
      return { kind: "sent", wamid: "wamid.TEMPLATE" };
    },
  });
  assert.deepEqual(outcome, { ok: true, wamid: "wamid.TEMPLATE" });
  assert.deepEqual(templateCalls, [
    { to: "15551234567", name: "order_confirmed", language: "en", params: ["#ORD-123", "Mumbai"] },
  ]);
  assert.equal(fake.appliedUpdate?.template_name, "order_confirmed");
});

test("sendApprovedDraft rejects too many template params before transport", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation(),
    staleInbound(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
    templateParams: Array.from({ length: 11 }, () => "p"),
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "invalid_template");
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft rejects an oversized template param before transport", async () => {
  const { service, fake } = draftService(
    draftMessage(),
    draftConversation(),
    staleInbound(),
  );
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    templateName: "order_confirmed",
    templateParams: ["x".repeat(501)],
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "invalid_template");
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft claims atomically: one concurrent approval wins one transport call", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  let openGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  let transportCalls = 0;
  const send = async (to: string, body: string) => {
    transportCalls += 1;
    fake.sentCalls.push({ to, body });
    await gate;
    return { kind: "sent" as const, wamid: "wamid.ONE" };
  };

  const first = sendApprovedDraft(service, draftOwnerId, draftMessageId, { send });
  const second = sendApprovedDraft(service, draftOwnerId, draftMessageId, { send });

  // Both approvals must pass through the atomic claim before either transport is
  // released, so neither call can observe the winner's finalize early.
  await new Promise((resolve) => setTimeout(resolve, 0));
  openGate();

  const outcomes = await Promise.all([first, second]);
  assert.equal(outcomes.filter((outcome) => outcome.ok).length, 1);
  const alreadyClaimed = outcomes.filter(
    (outcome): outcome is { ok: false; code: "already_claimed"; message: string } =>
      !outcome.ok && outcome.code === "already_claimed",
  );
  assert.equal(alreadyClaimed.length, 1);
  assert.equal(transportCalls, 1);
  assert.equal(fake.finalizeCalls.length, 1);
  assert.equal(fake.releaseCalls.length, 0);
});

test("sendApprovedDraft reports already_claimed without calling transport when another approval holds the claim", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  fake.registry.set(draftMessageId, "other-approval-token");
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    send: async () => ({ kind: "sent", wamid: "wamid.X" }),
  });
  assert.deepEqual(outcome, {
    ok: false,
    code: "already_claimed",
    message: "This draft is already being sent by another approval; nothing was sent.",
  });
  assert.equal(fake.sentCalls.length, 0);
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft fails closed when the delivery claim cannot be recorded", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  fake.claimError = true;
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    send: async () => ({ kind: "sent", wamid: "wamid.X" }),
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "claim_failed");
  assert.match((outcome as { message: string }).message, /claim/);
  assert.equal(fake.sentCalls.length, 0);
  assert.equal(fake.appliedUpdate, null);
});

test("sendApprovedDraft maps DB-level claim denials to honest outcomes without sending", async () => {
  const cases: Array<{ reason: string; code: string }> = [
    { reason: "not_found", code: "not_found" },
    { reason: "not_draft", code: "not_draft" },
    { reason: "opted_out", code: "not_allowed" },
    { reason: "human_takeover", code: "not_allowed" },
    { reason: "ineligible", code: "not_allowed" },
  ];
  for (const entry of cases) {
    const { service, fake } = draftService(draftMessage(), draftConversation());
    fake.claimDenyReason = entry.reason;
    const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
      send: async () => ({ kind: "sent", wamid: "wamid.X" }),
    });
    assert.equal(outcome.ok, false, entry.reason);
    assert.equal((outcome as { code: string }).code, entry.code, entry.reason);
    assert.equal(fake.sentCalls.length, 0, entry.reason);
    assert.equal(fake.appliedUpdate, null, entry.reason);
  }
});

test("sendApprovedDraft releases the claim for certain no-send transport outcomes", async () => {
  const kinds = [
    { kind: "not_ready" },
    { kind: "invalid", reason: "empty_body" },
    { kind: "rate_limited" },
  ] as const;
  for (const sendOutcome of kinds) {
    const { service, fake } = draftService(draftMessage(), draftConversation());
    const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
      send: async () => sendOutcome,
    });
    assert.equal(outcome.ok, false, sendOutcome.kind);
    assert.equal((outcome as { code: string }).code, "send_failed", sendOutcome.kind);
    assert.equal(fake.releaseCalls.length, 1, sendOutcome.kind);
    assert.equal(fake.releaseCalls[0].messageId, draftMessageId, sendOutcome.kind);
    assert.equal(fake.registry.has(draftMessageId), false, sendOutcome.kind);
    assert.equal(fake.appliedUpdate, null, sendOutcome.kind);
  }
});

test("sendApprovedDraft keeps the claim on an ambiguous transport error (no silent auto-resend)", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  const outcome = await sendApprovedDraft(service, draftOwnerId, draftMessageId, {
    send: async () => ({ kind: "error" }),
  });
  assert.equal(outcome.ok, false);
  assert.equal((outcome as { code: string }).code, "send_failed");
  assert.equal(fake.releaseCalls.length, 0);
  assert.equal(fake.registry.has(draftMessageId), true);
  assert.equal(fake.appliedUpdate, null);
});

test("claim reports already_claimed for a second claimant and claim_error on RPC failure", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  const firstClaim = await claimOutboundMessageSend(service, draftMessageId, draftOwnerId);
  assert.equal(firstClaim.ok, true);
  const secondClaim = await claimOutboundMessageSend(service, draftMessageId, draftOwnerId);
  assert.equal(secondClaim.ok, false);
  assert.equal((secondClaim as { reason: string }).reason, "already_claimed");

  fake.claimError = true;
  const failed = await claimOutboundMessageSend(service, draftMessageId, draftOwnerId);
  assert.equal(failed.ok, false);
  assert.equal((failed as { reason: string }).reason, "claim_error");
});

test("finalize only succeeds with the matching claim token", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  const claim = await claimOutboundMessageSend(service, draftMessageId, draftOwnerId);
  assert.equal(claim.ok, true);
  const token = claim.ok ? claim.token : "";

  const wrong = await finalizeOutboundMessageSend(
    service,
    draftMessageId,
    "wrong-token",
    draftOwnerId,
    { waMessageId: "wamid.X", sentAt: new Date().toISOString() },
  );
  assert.equal(wrong.ok, false);
  assert.equal((wrong as { reason: string }).reason, "claim_mismatch");
  const appliedByWrongToken = fake.appliedUpdate;
  assert.equal(appliedByWrongToken, null);

  const right = await finalizeOutboundMessageSend(service, draftMessageId, token, draftOwnerId, {
    waMessageId: "wamid.X",
    sentAt: new Date().toISOString(),
  });
  assert.equal(right.ok, true);
  assert.equal(fake.appliedUpdate?.status, "sent");
  assert.equal(fake.appliedUpdate?.wa_message_id, "wamid.X");
  assert.equal(fake.registry.has(draftMessageId), false);
});

test("release clears only the matching claim token", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  const claim = await claimOutboundMessageSend(service, draftMessageId, draftOwnerId);
  assert.equal(claim.ok, true);
  const token = claim.ok ? claim.token : "";

  const wrong = await releaseOutboundMessageSend(service, draftMessageId, "wrong-token", draftOwnerId);
  assert.equal(wrong.ok, false);
  assert.equal((wrong as { reason: string }).reason, "claim_mismatch");
  assert.equal(fake.registry.get(draftMessageId), token);

  const right = await releaseOutboundMessageSend(service, draftMessageId, token, draftOwnerId);
  assert.equal(right.ok, true);
  assert.equal(fake.registry.has(draftMessageId), false);
});

test("finalize and release fail closed when their RPC errors", async () => {
  const { service, fake } = draftService(draftMessage(), draftConversation());
  fake.updateError = true;
  const finalize = await finalizeOutboundMessageSend(
    service,
    draftMessageId,
    "tok",
    draftOwnerId,
    { waMessageId: "wamid.X", sentAt: new Date().toISOString() },
  );
  assert.equal(finalize.ok, false);
  assert.equal((finalize as { reason: string }).reason, "finalize_error");
  assert.equal(fake.appliedUpdate, null);

  fake.releaseError = true;
  const release = await releaseOutboundMessageSend(service, draftMessageId, "tok", draftOwnerId);
  assert.equal(release.ok, false);
  assert.equal((release as { reason: string }).reason, "release_error");
});
