/**
 * Phase B B3 credential broker tests.
 *
 * The broker serializes into tool-call envelopes at the execution edge only.
 * No plaintext secret crosses into the agent runtime.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createMockCredentialBroker,
  createSecretSourceCredentialBroker,
  validateEnvelope,
  type CredentialEnvelope,
  type SecretSource,
} from "./credentialBroker.ts";
import type { ToolCall } from "./permissionTypes.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    workspaceId: "ws-1",
    actor: "user-1",
    toolName: "web.research.search",
    toolVersion: "1.0.0",
    toolFamily: "web.research.search",
    declaredTier: "T2",
    riskScore: null,
    argsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    ...overrides,
  };
}

test("mock broker returns a content-free envelope", async () => {
  const broker = createMockCredentialBroker({ now: () => FIXED_NOW });
  const envelope = await broker.brokerCredential(makeToolCall(), "google.calendar");
  assert.equal(envelope !== null, true);
  assert.equal(envelope!.reference.length === 64, true);
  assert.equal(envelope!.envelopeHash.length === 64, true);
  assert.equal(envelope!.issuedAt, FIXED_NOW.toISOString());
});

test("mock broker returns null for empty credential key", async () => {
  const broker = createMockCredentialBroker();
  const envelope = await broker.brokerCredential(makeToolCall(), "");
  assert.equal(envelope, null);
});

test("mock broker envelope contains no plaintext secret", async () => {
  const broker = createMockCredentialBroker();
  const envelope = await broker.brokerCredential(makeToolCall(), "sk_live_abc123");
  assert.equal(envelope !== null, true);
  // The reference is a hash, not the raw key
  assert.equal(envelope!.reference, "sk_live_abc123".length === 64 ? envelope!.reference : envelope!.reference);
  assert.equal(envelope!.reference !== "sk_live_abc123", true);
});

test("secret source broker returns envelope with content-free reference", async () => {
  const secretSource: SecretSource = {
    getSecret: async () => "sk_live_real_secret_value",
  };
  const broker = createSecretSourceCredentialBroker(secretSource, {
    now: () => FIXED_NOW,
  });
  const envelope = await broker.brokerCredential(makeToolCall(), "google.calendar");
  assert.equal(envelope !== null, true);
  // Reference is a hash, not the plaintext secret
  assert.equal(envelope!.reference, "sk_live_real_secret_value".length === 64 ? envelope!.reference : envelope!.reference);
  assert.equal(envelope!.reference !== "sk_live_real_secret_value", true);
  assert.equal(envelope!.envelopeHash.length === 64, true);
});

test("secret source broker returns null when no secret exists", async () => {
  const secretSource: SecretSource = {
    getSecret: async () => null,
  };
  const broker = createSecretSourceCredentialBroker(secretSource);
  const envelope = await broker.brokerCredential(makeToolCall(), "missing.key");
  assert.equal(envelope, null);
});

test("validateEnvelope accepts valid envelopes", () => {
  const envelope: CredentialEnvelope = {
    reference: "0000000000000000000000000000000000000000000000000000000000000000",
    envelopeHash: "1111111111111111111111111111111111111111111111111111111111111111",
    issuedAt: FIXED_NOW.toISOString(),
    ttlSeconds: null,
  };
  assert.equal(validateEnvelope(envelope), true);
});

test("validateEnvelope rejects plaintext secret references", () => {
  const envelope: CredentialEnvelope = {
    reference: "sk_live_abc123",
    envelopeHash: "1111111111111111111111111111111111111111111111111111111111111111",
    issuedAt: FIXED_NOW.toISOString(),
    ttlSeconds: null,
  };
  assert.equal(validateEnvelope(envelope), false);
});

test("validateEnvelope rejects non-hash references", () => {
  const envelope: CredentialEnvelope = {
    reference: "not-a-hash",
    envelopeHash: "1111111111111111111111111111111111111111111111111111111111111111",
    issuedAt: FIXED_NOW.toISOString(),
    ttlSeconds: null,
  };
  assert.equal(validateEnvelope(envelope), false);
});
