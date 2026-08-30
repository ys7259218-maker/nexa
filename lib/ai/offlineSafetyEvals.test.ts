import assert from "node:assert/strict";
import test from "node:test";
import { OFFLINE_SAFETY_EVAL_CATEGORIES, runOfflineSafetyEvals } from "./offlineSafetyEvals.ts";

test("offline AI safety suite covers every v1 category and passes without network access", async () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error("Network access is forbidden in offline AI safety evaluations."); };
  try {
    const results = await runOfflineSafetyEvals();
    const covered = new Set(results.map((result) => result.category));
    assert.ok(results.length >= 8);
    for (const category of OFFLINE_SAFETY_EVAL_CATEGORIES) assert.ok(covered.has(category), `missing category: ${category}`);
    assert.deepEqual(results.filter((result) => !result.passed), []);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("offline AI safety results contain stable identifiers and no fixture content", async () => {
  const results = await runOfflineSafetyEvals();
  assert.equal(new Set(results.map((result) => result.id)).size, results.length);
  assert.ok(results.every((result) => result.failures.length === 0));
  assert.doesNotMatch(JSON.stringify(results), /Example Clinic|कृपया|SYSTEM:/);
});
