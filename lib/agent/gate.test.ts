import assert from "node:assert/strict";
import test from "node:test";

import {
  agentRuntimeGateLabel,
  inspectAgentRuntimeGate,
  isAgentRuntimeEnabled,
} from "./gate.ts";

const enabled = { AGENT_RUNTIME_ENABLED: "true", NODE_ENV: "test" };

test("agent runtime is disabled unless the flag is exactly true", () => {
  assert.deepEqual(inspectAgentRuntimeGate({}), { enabled: false, reason: "flag_off" });
  assert.deepEqual(inspectAgentRuntimeGate({ NODE_ENV: "test" }), {
    enabled: false,
    reason: "flag_off",
  });

  for (const value of ["false", "TRUE", "True", "1", "yes", " true", "true ", ""]) {
    assert.deepEqual(
      inspectAgentRuntimeGate({ AGENT_RUNTIME_ENABLED: value, NODE_ENV: "test" }),
      { enabled: false, reason: "flag_off" },
      `value ${JSON.stringify(value)} must stay off`,
    );
  }

  assert.deepEqual(inspectAgentRuntimeGate(enabled), {
    enabled: true,
    reason: "enabled",
  });
  assert.equal(isAgentRuntimeEnabled(enabled), true);
  assert.equal(isAgentRuntimeEnabled({}), false);
});

test("production hard-off wins even when the flag is exactly true", () => {
  assert.deepEqual(
    inspectAgentRuntimeGate({ AGENT_RUNTIME_ENABLED: "true", NODE_ENV: "production" }),
    { enabled: false, reason: "production" },
  );
  assert.deepEqual(
    inspectAgentRuntimeGate({
      AGENT_RUNTIME_ENABLED: "true",
      VERCEL_ENV: "production",
    }),
    { enabled: false, reason: "production" },
  );
  assert.deepEqual(
    inspectAgentRuntimeGate({
      AGENT_RUNTIME_ENABLED: "true",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    }),
    { enabled: false, reason: "production" },
  );

  assert.equal(
    isAgentRuntimeEnabled({
      AGENT_RUNTIME_ENABLED: "true",
      VERCEL_ENV: "production",
    }),
    false,
  );
});

test("non-production Vercel environments may still enable the flag", () => {
  assert.deepEqual(
    inspectAgentRuntimeGate({
      AGENT_RUNTIME_ENABLED: "true",
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
    }),
    { enabled: false, reason: "production" },
    "NODE_ENV production is still a hard-off",
  );

  assert.deepEqual(
    inspectAgentRuntimeGate({
      AGENT_RUNTIME_ENABLED: "true",
      VERCEL_ENV: "preview",
      NODE_ENV: "test",
    }),
    { enabled: true, reason: "enabled" },
  );
});

test("gate labels are human-readable and never claim production is enabled", () => {
  assert.match(agentRuntimeGateLabel({ enabled: true, reason: "enabled" }), /non-production/i);
  assert.match(agentRuntimeGateLabel({ enabled: false, reason: "production" }), /hard-off/i);
  assert.match(agentRuntimeGateLabel({ enabled: false, reason: "flag_off" }), /disabled/i);
});
