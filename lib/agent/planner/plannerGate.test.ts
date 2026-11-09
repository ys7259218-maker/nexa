/**
 * Phase B B4 planner gate tests.
 *
 * The only enabling value is the exact string "true"; every absent, empty,
 * ambiguous, or differently-cased value is off. The gate is hard-off in
 * production.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectPlannerGate,
  isPlannerEnabled,
  plannerGateLabel,
} from "./plannerGate.ts";

test("planner gate is off by default", () => {
  const gate = inspectPlannerGate({});
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, "flag_off");
});

test("planner gate requires exact 'true'", () => {
  for (const value of [undefined, "", "TRUE", "True", "true ", " tRue", "1", "yes"]) {
    const gate = inspectPlannerGate({
      AGENT_PLANNING_ORCHESTRATION_ENABLED: value,
    });
    assert.equal(gate.enabled, false, `value ${JSON.stringify(value)} should be off`);
    assert.equal(gate.reason, "flag_off");
  }
});

test("planner gate is on only for exact 'true'", () => {
  const gate = inspectPlannerGate({
    AGENT_PLANNING_ORCHESTRATION_ENABLED: "true",
  });
  assert.equal(gate.enabled, true);
  assert.equal(gate.reason, "enabled");
});

test("planner gate is hard-off in production", () => {
  for (const env of [
    { NODE_ENV: "production", AGENT_PLANNING_ORCHESTRATION_ENABLED: "true" },
    { VERCEL_ENV: "production", AGENT_PLANNING_ORCHESTRATION_ENABLED: "true" },
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      AGENT_PLANNING_ORCHESTRATION_ENABLED: "true",
    },
  ]) {
    const gate = inspectPlannerGate(env);
    assert.equal(gate.enabled, false);
    assert.equal(gate.reason, "production");
  }
});

test("isPlannerEnabled mirrors the gate", () => {
  assert.equal(isPlannerEnabled({}), false);
  assert.equal(
    isPlannerEnabled({
      AGENT_PLANNING_ORCHESTRATION_ENABLED: "true",
    }),
    true,
  );
});

test("plannerGateLabel returns reviewed labels", () => {
  assert.equal(
    plannerGateLabel({ enabled: true, reason: "enabled" }),
    "Enabled for non-production mock contracts",
  );
  assert.equal(
    plannerGateLabel({ enabled: false, reason: "production" }),
    "Hard-off in production",
  );
  assert.equal(
    plannerGateLabel({ enabled: false, reason: "flag_off" }),
    "Disabled (default)",
  );
});
