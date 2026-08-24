import assert from "node:assert/strict";
import test from "node:test";

import { OpenAIProvider } from "./openAIProvider.ts";

const context = {
  businessName: "Bright Dental",
  employeeName: "Ava",
  greetingMessage: "Welcome!",
  knowledgeNotes: "Open Monday to Friday.",
  customerMessage: "Are you open Friday?",
};

test("OpenAIProvider calls Responses API with server-safe settings", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: " Yes, we are open Friday. " }] }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const provider = new OpenAIProvider("test-key", "test-model", fakeFetch);
  const reply = await provider.generateReply(context);
  const request = requests[0];

  assert.equal(reply, "Yes, we are open Friday.");
  assert.equal(request?.url, "https://api.openai.com/v1/responses");
  assert.equal(request?.init?.method, "POST");
  assert.equal((request?.init?.headers as Record<string, string>).Authorization, "Bearer test-key");
  const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>;
  assert.equal(body.model, "test-model");
  assert.equal(body.store, false);
  assert.match(String(body.input), /Bright Dental/);
});

test("OpenAIProvider returns sanitized failures without response contents", async () => {
  const failingFetch = async () => new Response("sensitive provider details", { status: 429 });
  const provider = new OpenAIProvider("test-key", "test-model", failingFetch);

  await assert.rejects(() => provider.generateReply(context), {
    message: "OpenAI reply generation failed.",
  });
});

test("OpenAIProvider rejects empty output and caps reply length", async () => {
  const emptyProvider = new OpenAIProvider("key", "model", async () =>
    new Response(JSON.stringify({ output: [] }), { status: 200 }),
  );
  await assert.rejects(() => emptyProvider.generateReply(context), {
    message: "OpenAI returned an empty reply.",
  });

  const longProvider = new OpenAIProvider("key", "model", async () =>
    new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: "x".repeat(900) }] }],
    }), { status: 200 }),
  );
  assert.equal((await longProvider.generateReply(context)).length, 600);
});
