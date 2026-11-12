/**
 * Phase B B6: ChatModel contract tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedString,
  boundedToolSchema,
  clampTemperature,
  clampMaxOutputTokens,
  emptyChatCompletionOutput,
  isChatMessageRole,
} from "./chatModel.ts";

test("isChatMessageRole accepts valid roles", () => {
  assert.equal(isChatMessageRole("system"), true);
  assert.equal(isChatMessageRole("user"), true);
  assert.equal(isChatMessageRole("assistant"), true);
  assert.equal(isChatMessageRole("tool"), true);
});

test("isChatMessageRole rejects invalid roles", () => {
  assert.equal(isChatMessageRole(null), false);
  assert.equal(isChatMessageRole(undefined), false);
  assert.equal(isChatMessageRole("admin"), false);
  assert.equal(isChatMessageRole(""), false);
  assert.equal(isChatMessageRole(123), false);
});

test("boundedString truncates long strings", () => {
  const long = "a".repeat(100);
  assert.equal(boundedString(long, 10), "aaaaaaaaaa");
});

test("boundedString returns short strings unchanged", () => {
  assert.equal(boundedString("hi", 100), "hi");
});

test("boundedString handles null and undefined", () => {
  assert.equal(boundedString(null, 10), "");
  assert.equal(boundedString(undefined, 10), "");
});

test("boundedToolSchema truncates long schemas", () => {
  const long = "x".repeat(5000);
  assert.equal(boundedToolSchema(long).length, 4000);
});

test("boundedToolSchema handles null", () => {
  assert.equal(boundedToolSchema(null), "{}");
});

test("clampTemperature clamps to [0, 2]", () => {
  assert.equal(clampTemperature(null), null);
  assert.equal(clampTemperature(-1), 0);
  assert.equal(clampTemperature(0), 0);
  assert.equal(clampTemperature(1), 1);
  assert.equal(clampTemperature(2), 2);
  assert.equal(clampTemperature(3), 2);
});

test("clampMaxOutputTokens clamps to [1, 4096]", () => {
  assert.equal(clampMaxOutputTokens(null), null);
  assert.equal(clampMaxOutputTokens(0), 1);
  assert.equal(clampMaxOutputTokens(1), 1);
  assert.equal(clampMaxOutputTokens(100), 100);
  assert.equal(clampMaxOutputTokens(4096), 4096);
  assert.equal(clampMaxOutputTokens(5000), 4096);
});

test("emptyChatCompletionOutput returns zeroed output", () => {
  const out = emptyChatCompletionOutput("test-model");
  assert.equal(out.model, "test-model");
  assert.equal(out.choices.length, 0);
  assert.equal(out.usage.inputTokens, 0);
  assert.equal(out.usage.outputTokens, 0);
  assert.equal(out.usage.totalTokens, 0);
  assert.equal(out.systemFingerprint, null);
});
