/**
 * B8 offline agent evaluation entrypoint (`npm run eval:agent`).
 *
 * Deterministic and offline: fixed clock, fixed id factory, in-memory stores
 * and the mock browser driver. Exits non-zero if any scenario case fails.
 */

import { createAgentEvalRunner } from "../lib/agent/eval/runner.ts";
import { agentEvalScenarioSuites } from "../lib/agent/eval/scenarios.ts";

const FIXED_NOW = "2026-11-17T09:00:00.000Z";

let nextId = 0;
const result = await createAgentEvalRunner({
  suites: agentEvalScenarioSuites,
  now: () => new Date(FIXED_NOW),
  idFactory: () => `agent_eval_${(nextId += 1)}`,
}).run();

console.log(
  `Agent offline evaluations: ${result.passedCases}/${result.totalCases} cases passed.`,
);

for (const suite of result.suites) {
  for (const testCase of suite.cases) {
    const status = testCase.passed ? "pass" : "FAIL";
    const codes = testCase.failureCodes.length
      ? ` (${testCase.failureCodes.join(", ")})`
      : "";
    console.log(`${status} ${suite.id}/${testCase.id}${codes}`);
  }
}

if (!result.passed) {
  console.error(
    `Agent offline evaluations failed: run ${result.runId} codes ${result.failureCodes.join(", ") || "none"}.`,
  );
  process.exitCode = 1;
}
