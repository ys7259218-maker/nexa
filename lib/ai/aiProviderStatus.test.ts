import assert from "node:assert/strict";
import test from "node:test";

import { describeAIProviderStatus } from "./aiProviderStatus.ts";

test("defaults to the safe mock provider when AI_PROVIDER is unset or blank", () => {
  assert.deepEqual(describeAIProviderStatus({}), { kind: "mock" });
  assert.deepEqual(describeAIProviderStatus({ AI_PROVIDER: "   " }), { kind: "mock" });
  assert.deepEqual(describeAIProviderStatus({ AI_PROVIDER: " MOCK " }), { kind: "mock" });
});

test("reports OpenAI as ready only when key and model are both present", () => {
  assert.deepEqual(describeAIProviderStatus({ AI_PROVIDER: "openai" }), {
    kind: "openai",
    ready: false,
  });
  assert.deepEqual(describeAIProviderStatus({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" }), {
    kind: "openai",
    ready: false,
  });
  assert.deepEqual(
    describeAIProviderStatus({ AI_PROVIDER: "openai", OPENAI_MODEL: "gpt-5" }),
    { kind: "openai", ready: false },
  );
  assert.deepEqual(
    describeAIProviderStatus({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "k",
      OPENAI_MODEL: "gpt-5",
    }),
    { kind: "openai", ready: true },
  );
});

test("flags an unknown provider name without exposing a secret", () => {
  assert.deepEqual(describeAIProviderStatus({ AI_PROVIDER: "anthropic" }), {
    kind: "unsupported",
    value: "anthropic",
  });
  assert.deepEqual(describeAIProviderStatus({ AI_PROVIDER: "  ANTHROPIC  " }), {
    kind: "unsupported",
    value: "anthropic",
  });
});
