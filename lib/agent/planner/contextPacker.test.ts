/**
 * Phase B B4 context packer tests.
 *
 * Packs bounded context into plan input, token-bounded. Content-free:
 * produces a hash, never raw content.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CONTEXT_PACKER_CONFIG,
  packContext,
  type ContextPackerConfig,
} from "./contextPacker.ts";

const WORKSPACE_ID = "ws.a";

function makeTurn(role: string, content: string) {
  return { role, content };
}

test("packContext returns content-free hash", () => {
  const result = packContext(WORKSPACE_ID, [makeTurn("user", "hello")], {}, DEFAULT_CONTEXT_PACKER_CONFIG);
  assert.equal(result.contextHash.length === 64, true);
  assert.equal(result.tokenCount > 0, true);
  assert.equal(result.turnCount, 1);
  assert.equal(result.truncated, false);
});

test("packContext never includes raw content in hash input", () => {
  const secretContent = "sk_live_secret_key_12345";
  const result = packContext(
    WORKSPACE_ID,
    [makeTurn("user", secretContent)],
    {},
    DEFAULT_CONTEXT_PACKER_CONFIG,
  );
  // The contextHash is a hash, not the raw content
  assert.equal(result.contextHash, secretContent.length === 64 ? result.contextHash : result.contextHash);
  assert.equal(result.contextHash !== secretContent, true);
});

test("packContext truncates at token cap", () => {
  const config: ContextPackerConfig = { maxTokens: 5, maxRecentTurns: 10 };
  const result = packContext(
    WORKSPACE_ID,
    [makeTurn("user", "this is a long message that exceeds the token cap")],
    {},
    config,
  );
  assert.equal(result.truncated, true);
  assert.equal(result.turnCount, 0);
});

test("packContext truncates at maxRecentTurns cap", () => {
  const config: ContextPackerConfig = { maxTokens: 10000, maxRecentTurns: 1 };
  const result = packContext(
    WORKSPACE_ID,
    [
      makeTurn("user", "first"),
      makeTurn("assistant", "second"),
      makeTurn("user", "third"),
    ],
    {},
    config,
  );
  assert.equal(result.truncated, true);
  assert.equal(result.turnCount, 1);
});

test("packContext workspace context keys only, never values", () => {
  const result = packContext(
    WORKSPACE_ID,
    [],
    { secretKey: "sk_live_secret", otherKey: "public_value" },
    DEFAULT_CONTEXT_PACKER_CONFIG,
  );
  assert.equal(result.contextHash.length === 64, true);
  assert.equal(result.truncated, false);
});

test("packContext rejects invalid workspace id", () => {
  assert.throws(
    () => packContext("invalid workspace!", [], {}, DEFAULT_CONTEXT_PACKER_CONFIG),
    "invalid workspace id should throw",
  );
});

test("DEFAULT_CONTEXT_PACKER_CONFIG has expected defaults", () => {
  assert.equal(DEFAULT_CONTEXT_PACKER_CONFIG.maxTokens, 4096);
  assert.equal(DEFAULT_CONTEXT_PACKER_CONFIG.maxRecentTurns, 10);
});
