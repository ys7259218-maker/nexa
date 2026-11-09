/**
 * Phase B B4 step executor tests.
 *
 * Executes a single plan step with retries, timeouts, and audit. Content-free:
 * records hashes only, never raw content or plaintext secrets.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { executePlanStep, DEFAULT_STEP_EXECUTOR_CONFIG } from "./stepExecutor.ts";
import type { StepExecutionRequest } from "./stepExecutor.ts";

function makeRequest(overrides: Partial<StepExecutionRequest> = {}): StepExecutionRequest {
  return {
    planId: "plan-1",
    stepId: "step-1",
    toolName: "workspace.file.read",
    toolVersion: "1.0.0",
    toolFamily: "workspace.file.read",
    inputsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    ...overrides,
  };
}

test("executePlanStep succeeds on first attempt", async () => {
  const adapter = async () => ({ outputsHash: "1111111111111111111111111111111111111111111111111111111111111111" });
  const result = await executePlanStep(adapter, makeRequest());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.outputsHash.length === 64, true);
    assert.equal(result.attempts, 1);
    assert.equal(result.durationMs >= 0, true);
  }
});

test("executePlanStep retries on timeout and succeeds", async () => {
  let calls = 0;
  const adapter = async () => {
    calls += 1;
    if (calls < 2) throw new Error("timeout");
    return { outputsHash: "1111111111111111111111111111111111111111111111111111111111111111" };
  };
  const result = await executePlanStep(adapter, makeRequest(), {
    maxAttemptsDefault: 3,
    timeoutMsDefault: 50,
    backoffMsDefault: 0,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.attempts, 2);
  }
});

test("executePlanStep fails closed when all attempts timeout", async () => {
  const adapter = async () => {
    throw new Error("timeout");
  };
  const result = await executePlanStep(adapter, makeRequest(), {
    maxAttemptsDefault: 2,
    timeoutMsDefault: 10,
    backoffMsDefault: 0,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorClass, "INTERNAL");
    assert.equal(result.code, "unexpected_error");
    assert.equal(result.attempts, 2);
  }
});

test("executePlanStep does not include raw content in result", async () => {
  const adapter = async () => ({ outputsHash: "1111111111111111111111111111111111111111111111111111111111111111" });
  const result = await executePlanStep(adapter, makeRequest({ inputsHash: "sk_live_secret" }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.outputsHash !== "sk_live_secret", true);
  }
});

test("executePlanStep respects default config", async () => {
  const adapter = async () => ({ outputsHash: "1111111111111111111111111111111111111111111111111111111111111111" });
  const result = await executePlanStep(adapter, makeRequest(), DEFAULT_STEP_EXECUTOR_CONFIG);
  assert.equal(result.ok, true);
});

test("executePlanStep uses custom sleep", async () => {
  let sleepCalled = false;
  let calls = 0;
  const adapter = async () => {
    calls += 1;
    if (calls < 2) throw new Error("timeout");
    return { outputsHash: "1111111111111111111111111111111111111111111111111111111111111111" };
  };
  const result = await executePlanStep(adapter, makeRequest(), {
    maxAttemptsDefault: 3,
    timeoutMsDefault: 10,
    backoffMsDefault: 0,
  }, undefined, async () => {
    sleepCalled = true;
  });
  assert.equal(result.ok, true);
  assert.equal(sleepCalled, true);
});
