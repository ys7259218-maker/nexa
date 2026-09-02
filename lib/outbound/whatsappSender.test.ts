import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTextPayload,
  createRateLimiter,
  isOutboundSendReady,
  isTransient,
  parseOutboundConfig,
  sendTextMessage,
  type FetchLike,
  type OutboundSenderConfig,
} from "./whatsappSender.ts";

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
