import assert from "node:assert/strict";
import { test } from "node:test";

import { MockAIProvider } from "./mockProvider.ts";
import type { AIReplyContext } from "./provider.ts";

function context(overrides: Partial<AIReplyContext> = {}): AIReplyContext {
  return {
    businessName: "Bright Dental",
    employeeName: "Ava",
    greetingMessage: "Welcome to Bright Dental!",
    knowledgeNotes: "",
    customerMessage: "Do you have openings on Friday?",
    ...overrides,
  };
}

test("MockAIProvider returns deterministic replies for regular messages", async () => {
  const provider = new MockAIProvider();

  const first = await provider.generateReply(context());
  const second = await provider.generateReply(context());

  assert.equal(first, second);
  assert.ok(first.includes("Bright Dental"));
  assert.ok(first.length > 0 && first.length <= 600);
});

test("MockAIProvider uses the configured greeting for greetings and empty input", async () => {
  const provider = new MockAIProvider();

  const greeting = await provider.generateReply(context({ customerMessage: "hello!" }));
  assert.equal(greeting, "Welcome to Bright Dental!");

  const empty = await provider.generateReply(context({ customerMessage: "   " }));
  assert.equal(empty, "Welcome to Bright Dental!");
});

test("MockAIProvider falls back safely when context fields are blank", async () => {
  const provider = new MockAIProvider();

  const reply = await provider.generateReply(
    context({
      businessName: "",
      employeeName: "",
      greetingMessage: "",
      customerMessage: "",
    }),
  );

  assert.ok(reply.includes("our assistant"));
  assert.ok(reply.includes("our business"));
});

test("MockAIProvider never rejects and collapses whitespace", async () => {
  const provider = new MockAIProvider();

  const reply = await provider.generateReply(context({ customerMessage: "line one\n\nline two\ttab" }));

  assert.ok(reply.length > 0);
});

test("MockAIProvider keeps the original greeting when no recent history exists", async () => {
  const provider = new MockAIProvider();

  const first = await provider.generateReply(
    context({ customerMessage: "hello!", recentMessages: [] }),
  );
  assert.equal(first, "Welcome to Bright Dental!");

  const second = await provider.generateReply(context({ customerMessage: "hello!" }));
  assert.equal(second, "Welcome to Bright Dental!");
});

test("MockAIProvider recalls prior turns instead of re-greeting", async () => {
  const provider = new MockAIProvider();

  const reply = await provider.generateReply(
    context({ customerMessage: "hello!", recentMessages: ["Do you have openings on Friday?"] }),
  );
  assert.ok(reply.includes("Hi again"), reply);
  assert.ok(reply.includes("Ava"), reply);
  assert.ok(reply.includes("Bright Dental"), reply);
});

