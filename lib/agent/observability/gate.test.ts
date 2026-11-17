/**
 * B8 observability gate tests (scope C5c/C5d, matrix OB-01/OB-02 support).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  agentObservabilityGateLabel,
  inspectAgentObservabilityGate,
  isAgentObservabilityEnabled,
} from "./gate.ts";

const ON = {
  AGENT_OBSERVABILITY_ENABLED: "true",
  AGENT_RUNTIME_ENABLED: "true",
} as const;

test("the observability flag is default-off and only the exact string true enables it", () => {
  assert.deepEqual(inspectAgentObservabilityGate({}), {
    enabled: false,
    reason: "flag_off",
  });
  for (const value of ["TRUE", "1", "yes", " true", ""]) {
    assert.equal(
      inspectAgentObservabilityGate({
        ...ON,
        AGENT_OBSERVABILITY_ENABLED: value,
      }).enabled,
      false,
    );
  }
});

test("the existing runtime flag must also be on", () => {
  assert.deepEqual(
    inspectAgentObservabilityGate({
      AGENT_OBSERVABILITY_ENABLED: "true",
    }),
    { enabled: false, reason: "runtime_off" },
  );
  assert.equal(isAgentObservabilityEnabled(ON), true);
});

test("production is hard-off even when both flags are copied in", () => {
  assert.deepEqual(
    inspectAgentObservabilityGate({ ...ON, NODE_ENV: "production" }),
    { enabled: false, reason: "production" },
  );
  assert.deepEqual(
    inspectAgentObservabilityGate({ ...ON, VERCEL_ENV: "production" }),
    { enabled: false, reason: "production" },
  );
});

test("the gate label never implies production enablement", () => {
  assert.match(agentObservabilityGateLabel({ enabled: true, reason: "enabled" }), /non-production/i);
  assert.match(
    agentObservabilityGateLabel({ enabled: false, reason: "production" }),
    /hard-off/i,
  );
  assert.match(
    agentObservabilityGateLabel({ enabled: false, reason: "runtime_off" }),
    /runtime/i,
  );
});
