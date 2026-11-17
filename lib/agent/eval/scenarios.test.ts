/**
 * B8 scenario pack tests (matrix SC-01 … SC-06).
 *
 * The scenarios themselves are deterministic and offline, so the assertion
 * here re-runs the whole pack through the real runner and reports the exact
 * failing case id if a contract regresses.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createAgentEvalRunner } from "./runner.ts";
import { agentEvalScenarioSuites } from "./scenarios.ts";

function fixedClock() {
  return () => new Date("2026-11-17T09:00:00.000Z");
}

function fixedIds() {
  let next = 0;
  return () => `scenario_${(next += 1)}`;
}

test("SC-01 … SC-06 replay B1/B3/B4/B5/B7 contracts offline", async () => {
  const result = await createAgentEvalRunner({
    suites: agentEvalScenarioSuites,
    now: fixedClock(),
    idFactory: fixedIds(),
  }).run();

  const failed = result.suites
    .flatMap((suite) => suite.cases)
    .filter((testCase) => !testCase.passed)
    .map((testCase) => `${testCase.id}:${testCase.failureCodes.join(",")}`);

  assert.deepEqual(failed, []);
  assert.equal(result.passed, true);
  assert.equal(result.totalCases, 6);

  const ids = result.suites[0]?.cases.map((testCase) => testCase.id) ?? [];
  assert.deepEqual(ids, ["SC-01", "SC-02", "SC-03", "SC-04", "SC-05", "SC-06"]);
});
