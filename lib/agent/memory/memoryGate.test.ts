/**
 * Phase B B5 memory gate tests.
 *
 * The only enabling value is the exact string "true"; every absent, empty,
 * ambiguous, or differently-cased value is off. The gate is hard-off in
 * production.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectMemoryGate,
  isMemorySystemEnabled,
  memoryGateLabel,
} from "./memoryGate.ts";

test("memory gate is off by default", () => {
  const gate = inspectMemoryGate({});
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, "flag_off");
});

test("memory gate requires exact 'true'", () => {
  for (const value of [undefined, "", "TRUE", "True", "true ", " tRue", "1", "yes"]) {
    const gate = inspectMemoryGate({
      AGENT_MEMORY_SYSTEM_ENABLED: value,
    });
    assert.equal(gate.enabled, false, `value ${JSON.stringify(value)} should be off`);
    assert.equal(gate.reason, "flag_off");
  }
});

test("memory gate is on only for exact 'true'", () => {
  const gate = inspectMemoryGate({
    AGENT_MEMORY_SYSTEM_ENABLED: "true",
  });
  assert.equal(gate.enabled, true);
  assert.equal(gate.reason, "enabled");
});

test("memory gate is hard-off in production", () => {
  for (const env of [
    { NODE_ENV: "production", AGENT_MEMORY_SYSTEM_ENABLED: "true" },
    { VERCEL_ENV: "production", AGENT_MEMORY_SYSTEM_ENABLED: "true" },
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      AGENT_MEMORY_SYSTEM_ENABLED: "true",
    },
  ]) {
    const gate = inspectMemoryGate(env);
    assert.equal(gate.enabled, false);
    assert.equal(gate.reason, "production");
  }
});

test("isMemorySystemEnabled mirrors the gate", () => {
  assert.equal(isMemorySystemEnabled({}), false);
  assert.equal(
    isMemorySystemEnabled({
      AGENT_MEMORY_SYSTEM_ENABLED: "true",
    }),
    true,
  );
});

test("memoryGateLabel returns reviewed labels", () => {
  assert.equal(
    memoryGateLabel({ enabled: true, reason: "enabled" }),
    "Enabled for non-production mock contracts",
  );
  assert.equal(
    memoryGateLabel({ enabled: false, reason: "production" }),
    "Hard-off in production",
  );
  assert.equal(
    memoryGateLabel({ enabled: false, reason: "flag_off" }),
    "Disabled (default)",
  );
});
