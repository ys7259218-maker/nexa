/**
 * Phase B B3 permission engine kill switch tests.
 *
 * The only enabling value is the exact string "true"; every absent, empty,
 * ambiguous, or differently-cased value is off. The gate is hard-off in
 * production.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectAgentPermissionEngineGate,
  isAgentPermissionEngineEnabled,
  agentPermissionEngineGateLabel,
} from "./permissionGate.ts";

test("permission engine gate is off by default", () => {
  const gate = inspectAgentPermissionEngineGate({});
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, "flag_off");
});

test("permission engine gate requires exact 'true'", () => {
  for (const value of [undefined, "", "TRUE", "True", "true ", " tRue", "1", "yes"]) {
    const gate = inspectAgentPermissionEngineGate({
      AGENT_PERMISSION_ENGINE_ENABLED: value,
    });
    assert.equal(gate.enabled, false, `value ${JSON.stringify(value)} should be off`);
    assert.equal(gate.reason, "flag_off");
  }
});

test("permission engine gate is on only for exact 'true'", () => {
  const gate = inspectAgentPermissionEngineGate({
    AGENT_PERMISSION_ENGINE_ENABLED: "true",
  });
  assert.equal(gate.enabled, true);
  assert.equal(gate.reason, "enabled");
});

test("permission engine gate is hard-off in production", () => {
  for (const env of [
    { NODE_ENV: "production", AGENT_PERMISSION_ENGINE_ENABLED: "true" },
    { VERCEL_ENV: "production", AGENT_PERMISSION_ENGINE_ENABLED: "true" },
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      AGENT_PERMISSION_ENGINE_ENABLED: "true",
    },
  ]) {
    const gate = inspectAgentPermissionEngineGate(env);
    assert.equal(gate.enabled, false);
    assert.equal(gate.reason, "production");
  }
});

test("isAgentPermissionEngineEnabled mirrors the gate", () => {
  assert.equal(isAgentPermissionEngineEnabled({}), false);
  assert.equal(
    isAgentPermissionEngineEnabled({
      AGENT_PERMISSION_ENGINE_ENABLED: "true",
    }),
    true,
  );
});

test("agentPermissionEngineGateLabel returns reviewed labels", () => {
  assert.equal(
    agentPermissionEngineGateLabel({ enabled: true, reason: "enabled" }),
    "Enabled for non-production mock contracts",
  );
  assert.equal(
    agentPermissionEngineGateLabel({ enabled: false, reason: "production" }),
    "Hard-off in production",
  );
  assert.equal(
    agentPermissionEngineGateLabel({ enabled: false, reason: "flag_off" }),
    "Disabled (default)",
  );
});
