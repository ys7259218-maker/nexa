import assert from "node:assert/strict";
import test from "node:test";

import {
  describeInboundReadiness,
  describeInboundWebhookUrl,
  isInboundReady,
} from "./inboundReadiness.ts";

test("describeInboundReadiness flags missing secrets safely", () => {
  const state = describeInboundReadiness({});
  assert.equal(state.ready, false);
  assert.equal(state.items.length, 3);
  assert.deepEqual(
    state.items.map((item) => item.key),
    ["verify_token", "app_secret", "message_store"],
  );
  for (const item of state.items) {
    assert.equal(item.ready, false, `${item.key} must start unready`);
    assert.ok(!/token|secret|key|URL|url/i.test(item.detail.replace(/WHATSAPP_[A-Z_]+|NEXT_PUBLIC_[A-Z_]+|SUPABASE_[A-Z_]+/g, "var")), `${item.key} detail must not leak values`);
  }
});

test("describeInboundReadiness reports ready with all three configured", () => {
  const state = describeInboundReadiness({
    WHATSAPP_VERIFY_TOKEN: "abc",
    WHATSAPP_APP_SECRET: "def",
    SUPABASE_SERVICE_ROLE_KEY: "ghi",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  });
  assert.equal(state.ready, true);
  assert.ok(state.items.every((item) => item.ready));
});

test("describeInboundReadiness requires both Supabase variables for the store check", () => {
  const onlyUrl = describeInboundReadiness({
    WHATSAPP_VERIFY_TOKEN: "abc",
    WHATSAPP_APP_SECRET: "def",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  });
  assert.equal(onlyUrl.ready, false);
  assert.equal(onlyUrl.items[2].ready, false);

  const onlyKey = describeInboundReadiness({
    WHATSAPP_VERIFY_TOKEN: "abc",
    WHATSAPP_APP_SECRET: "def",
    SUPABASE_SERVICE_ROLE_KEY: "ghi",
  });
  assert.equal(onlyKey.items[2].ready, false);
});

test("describeInboundReadiness trims whitespace-only env values", () => {
  const state = describeInboundReadiness({
    WHATSAPP_VERIFY_TOKEN: "   ",
    WHATSAPP_APP_SECRET: "  ",
    SUPABASE_SERVICE_ROLE_KEY: "",
    NEXT_PUBLIC_SUPABASE_URL: " ",
  });
  assert.equal(state.items.every((item) => !item.ready), true);
});

test("isInboundReady reflects the readiness state only", () => {
  const ready = describeInboundReadiness({
    WHATSAPP_VERIFY_TOKEN: "abc",
    WHATSAPP_APP_SECRET: "def",
    SUPABASE_SERVICE_ROLE_KEY: "ghi",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  });
  assert.equal(isInboundReady(ready), true);
  assert.equal(isInboundReady(describeInboundReadiness({})), false);
});

test("describeInboundWebhookUrl strips a trailing slash and appends the route", () => {
  assert.equal(
    describeInboundWebhookUrl("https://example.com"),
    "https://example.com/api/whatsapp/webhook",
  );
  assert.equal(
    describeInboundWebhookUrl("https://example.com/"),
    "https://example.com/api/whatsapp/webhook",
  );
});