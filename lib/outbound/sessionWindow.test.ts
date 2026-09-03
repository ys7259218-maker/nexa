import assert from "node:assert/strict";
import test from "node:test";

import {
  isWithinServiceWindow,
  resolveAllowedMessageKind,
  validateTemplate,
  SERVICE_WINDOW_MS,
} from "./sessionWindow.ts";

const HOUR_MS = 60 * 60 * 1_000;
const NOW = Date.parse("2026-09-03T12:00:00Z");

test("resolveAllowedMessageKind allows freeform inside the 24h window", () => {
  const decision = resolveAllowedMessageKind(new Date(NOW - 1 * HOUR_MS).toISOString(), NOW);
  assert.deepEqual(decision, { kind: "freeform", withinWindow: true });
});

test("resolveAllowedMessageKind forces template exactly at and past the window", () => {
  const atBoundary = resolveAllowedMessageKind(new Date(NOW - SERVICE_WINDOW_MS).toISOString(), NOW);
  assert.equal(atBoundary.kind, "template");
  assert.equal(atBoundary.withinWindow, false);

  const expired = resolveAllowedMessageKind(new Date(NOW - 25 * HOUR_MS).toISOString(), NOW);
  assert.equal(expired.kind, "template");
  assert.equal(expired.withinWindow, false);
});

test("resolveAllowedMessageKind forces template when no inbound record exists", () => {
  assert.deepEqual(resolveAllowedMessageKind(null, NOW), { kind: "template", withinWindow: false });
});

test("resolveAllowedMessageKind forces template on unparsable inbound time", () => {
  assert.deepEqual(resolveAllowedMessageKind("not-a-date", NOW), {
    kind: "template",
    withinWindow: false,
  });
});

test("resolveAllowedMessageKind rejects a future inbound timestamp as stale", () => {
  const decision = resolveAllowedMessageKind(new Date(NOW + HOUR_MS).toISOString(), NOW);
  assert.equal(decision.kind, "template");
  assert.equal(decision.withinWindow, false);
});

test("resolveAllowedMessageKind treats the exact NOW as within window", () => {
  const decision = resolveAllowedMessageKind(new Date(NOW).toISOString(), NOW);
  assert.equal(decision.kind, "freeform");
});

test("isWithinServiceWindow mirrors resolveAllowedMessageKind", () => {
  const inbound = new Date(NOW - 2 * HOUR_MS).toISOString();
  assert.equal(isWithinServiceWindow(inbound, NOW), true);
  assert.equal(isWithinServiceWindow(null, NOW), false);
  assert.equal(isWithinServiceWindow(new Date(NOW - 25 * HOUR_MS).toISOString(), NOW), false);
});

test("validateTemplate accepts a clean, bounded template", () => {
  assert.deepEqual(validateTemplate({ name: "hello_world", language: "en_US" }), { valid: true });
  assert.deepEqual(
    validateTemplate({ name: "order_update_2", language: "hi", componentParams: ["#123"] }),
    { valid: true },
  );
});

test("validateTemplate rejects unsafe or unbounded templates", () => {
  assert.deepEqual(validateTemplate({ name: "", language: "en_US" }), {
    valid: false,
    reason: "empty_template_name",
  });
  assert.deepEqual(validateTemplate({ name: "hello world", language: "en_US" }), {
    valid: false,
    reason: "invalid_template_name",
  });
  assert.deepEqual(validateTemplate({ name: "hello_world", language: "" }), {
    valid: false,
    reason: "empty_template_language",
  });
  assert.deepEqual(
    validateTemplate({ name: "x".repeat(600), language: "en_US" }),
    { valid: false, reason: "template_name_too_long" },
  );
  const tooMany = validateTemplate({
    name: "t",
    language: "en_US",
    componentParams: Array.from({ length: 11 }, () => "p"),
  });
  assert.deepEqual(tooMany, { valid: false, reason: "template_params_too_many" });
});
