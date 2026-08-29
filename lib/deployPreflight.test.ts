import assert from "node:assert/strict";
import test from "node:test";

import { inspectClosedBetaEnvironment } from "./deployPreflight.ts";

const safeEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_synthetic_public_test_key",
  AI_PROVIDER: "mock",
  WHATSAPP_OUTBOUND_ENABLED: "false",
  WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED: "false",
  EMPLOYEE_LIFECYCLE_ENABLED: "false",
  AUDIT_LOG_ENABLED: "false",
  WORKSPACE_SAFETY_ENABLED: "false",
  TEAM_MANAGEMENT_ENABLED: "false",
  EMPLOYEE_VERSION_HISTORY_ENABLED: "false",
  KNOWLEDGE_V0_ENABLED: "false",
  KNOWLEDGE_SOURCE_REGISTRY_ENABLED: "false",
  CONVERSATION_SAFETY_ENABLED: "false",
};

test("closed-beta environment accepts explicit safe defaults", () => {
  assert.deepEqual(inspectClosedBetaEnvironment(safeEnvironment), []);
});

test("closed-beta environment rejects browser-side Supabase secrets safely", () => {
  const secretKey = "sb_secret_synthetic_value_that_must_not_be_printed";
  const issues = inspectClosedBetaEnvironment({
    ...safeEnvironment,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: secretKey,
  });

  assert.ok(issues.some((issue) => issue.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY")));
  assert.equal(issues.join(" ").includes(secretKey), false);
});

test("closed-beta environment accepts only anon-role legacy JWTs", () => {
  const jwt = (role: string) =>
    [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ role })).toString("base64url"),
      "synthetic-signature",
    ].join(".");

  assert.deepEqual(
    inspectClosedBetaEnvironment({
      ...safeEnvironment,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
    }),
    [],
  );

  const serviceRoleKey = jwt("service_role");
  const issues = inspectClosedBetaEnvironment({
    ...safeEnvironment,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: serviceRoleKey,
  });
  assert.ok(issues.some((issue) => issue.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY")));
  assert.equal(issues.join(" ").includes(serviceRoleKey), false);
});

test("closed-beta environment rejects Supabase URL paths, queries, and fragments", () => {
  for (const url of [
    "https://example-ref.supabase.co/rest",
    "https://example-ref.supabase.co?key=value",
    "https://example-ref.supabase.co#token",
  ]) {
    const issues = inspectClosedBetaEnvironment({
      ...safeEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: url,
    });
    assert.ok(issues.some((issue) => issue.startsWith("NEXT_PUBLIC_SUPABASE_URL")));
    assert.equal(issues.join(" ").includes(url), false);
  }
});

test("closed-beta environment rejects placeholders and unsafe flags", () => {
  const issues = inspectClosedBetaEnvironment({
    ...safeEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
    AI_PROVIDER: "openai",
    WHATSAPP_OUTBOUND_ENABLED: "true",
    WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED: "true",
    EMPLOYEE_VERSION_HISTORY_ENABLED: "true",
    KNOWLEDGE_V0_ENABLED: "true",
    KNOWLEDGE_SOURCE_REGISTRY_ENABLED: "true",
    CONVERSATION_SAFETY_ENABLED: "true",
  });

  assert.ok(issues.some((issue) => issue.startsWith("NEXT_PUBLIC_SUPABASE_URL")));
  assert.ok(issues.some((issue) => issue.startsWith("AI_PROVIDER")));
  assert.ok(issues.some((issue) => issue.startsWith("WHATSAPP_OUTBOUND_ENABLED")));
  assert.ok(issues.some((issue) => issue.startsWith("WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED")));
  assert.ok(issues.some((issue) => issue.startsWith("EMPLOYEE_VERSION_HISTORY_ENABLED")));
  assert.ok(issues.some((issue) => issue.startsWith("KNOWLEDGE_V0_ENABLED")));
  assert.ok(issues.some((issue) => issue.startsWith("KNOWLEDGE_SOURCE_REGISTRY_ENABLED")));
  assert.ok(issues.some((issue) => issue.startsWith("CONVERSATION_SAFETY_ENABLED")));
});

test("closed-beta environment requires an all-or-nothing inbound bundle", () => {
  const issues = inspectClosedBetaEnvironment({
    ...safeEnvironment,
    WHATSAPP_VERIFY_TOKEN: "configured-token",
  });

  assert.ok(issues.some((issue) => issue.startsWith("WhatsApp inbound configuration")));
});

test("closed-beta environment validates retry-secret length without exposing it", () => {
  const issues = inspectClosedBetaEnvironment({
    ...safeEnvironment,
    WHATSAPP_RETRY_SECRET: "too-short",
  });

  assert.deepEqual(issues, [
    "WHATSAPP_RETRY_SECRET must be empty or at least 32 characters.",
  ]);
  assert.equal(issues.join(" ").includes("too-short"), false);
});
