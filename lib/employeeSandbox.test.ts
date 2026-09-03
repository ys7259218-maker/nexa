import assert from "node:assert/strict";
import test from "node:test";

import {
  SANDBOX_INPUT_MAX_LENGTH,
  SANDBOX_OUTPUT_MAX_LENGTH,
  buildEmployeeSandboxContext,
  isValidSandboxEmployeeId,
  parseSandboxRecentMessages,
  runEmployeeSandbox,
  validateSandboxCustomerMessage,
  type SandboxEmployee,
} from "./employeeSandbox.ts";
import type { KnowledgeEntry } from "./knowledgeEntries.ts";

const employee: SandboxEmployee = {
  name: " Ava ",
  business_name: " Bright Dental ",
  greeting_message: " Welcome to Bright Dental! ",
  knowledge_notes: " Appointments are available Monday to Friday. ",
};

const verifiedFaq: KnowledgeEntry = {
  id: "22222222-2222-4222-8222-222222222222",
  workspace_id: "33333333-3333-4333-8333-333333333333",
  ai_employee_id: "11111111-1111-4111-8111-111111111111",
  kind: "faq",
  title: "Opening hours",
  question: "When are you open?",
  content: "We are open Monday to Friday, 9 AM to 5 PM.",
  verified: true,
  created_by: "44444444-4444-4444-8444-444444444444",
  updated_by: "44444444-4444-4444-8444-444444444444",
  created_at: "2026-08-27T00:00:00.000Z",
  updated_at: "2026-08-27T00:00:00.000Z",
};

test("sandbox validation trims valid input and rejects empty or oversized input", () => {
  assert.deepEqual(validateSandboxCustomerMessage("  hello  "), {
    ok: true,
    value: "hello",
  });
  assert.deepEqual(validateSandboxCustomerMessage("   "), {
    ok: false,
    error: "Enter a simulated customer message.",
  });
  assert.deepEqual(validateSandboxCustomerMessage(null), {
    ok: false,
    error: "Enter a simulated customer message.",
  });
  assert.deepEqual(
    validateSandboxCustomerMessage("x".repeat(SANDBOX_INPUT_MAX_LENGTH + 1)),
    {
      ok: false,
      error: `Customer message must be at most ${SANDBOX_INPUT_MAX_LENGTH} characters.`,
    },
  );
});

test("sandbox accepts only bounded UUID employee identifiers", () => {
  assert.equal(
    isValidSandboxEmployeeId("11111111-1111-4111-8111-111111111111"),
    true,
  );
  assert.equal(isValidSandboxEmployeeId("not-an-id"), false);
  assert.equal(isValidSandboxEmployeeId("a".repeat(200)), false);
  assert.equal(isValidSandboxEmployeeId(null), false);
});

test("sandbox maps only bounded employee context fields", () => {
  const context = buildEmployeeSandboxContext(employee, "Can I book Friday?");

  assert.deepEqual(context, {
    employeeName: "Ava",
    businessName: "Bright Dental",
    greetingMessage: "Welcome to Bright Dental!",
    knowledgeNotes: "Appointments are available Monday to Friday.",
    customerMessage: "Can I book Friday?",
  });

  const bounded = buildEmployeeSandboxContext(
    {
      name: "n".repeat(150),
      business_name: "b".repeat(200),
      greeting_message: "g".repeat(700),
      knowledge_notes: "k".repeat(700),
    },
    "m".repeat(SANDBOX_INPUT_MAX_LENGTH + 50),
  );

  assert.equal(bounded.employeeName.length, 100);
  assert.equal(bounded.businessName.length, 160);
  assert.equal(bounded.greetingMessage.length, 500);
  assert.equal(bounded.knowledgeNotes.length, 500);
  assert.equal(bounded.customerMessage.length, SANDBOX_INPUT_MAX_LENGTH);
});

test("sandbox forces the safe mock even when another provider is configured", async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.OPENAI_API_KEY;

  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "not-used-by-the-sandbox";

  try {
    const result = await runEmployeeSandbox(employee, "hello");

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.provider, "Safe mock");
    assert.equal(result.reply, "Welcome to Bright Dental!");
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;

    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("sandbox output is present and remains within the response bound", async () => {
  const result = await runEmployeeSandbox(
    {
      name: "Nexa Receptionist",
      business_name: "Acme Services",
      greeting_message: "",
      knowledge_notes: "k".repeat(500),
    },
    "Please explain all available services in detail.",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.reply.length > 0);
  assert.ok(result.reply.length <= SANDBOX_OUTPUT_MAX_LENGTH);
  assert.equal(result.customerMessage, "Please explain all available services in detail.");
});

test("sandbox uses only a verified structured FAQ for deterministic direct answers", async () => {
  const result = await runEmployeeSandbox(employee, "Hi, when are you open?", [verifiedFaq]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.provider, "Verified FAQ");
  assert.equal(result.reply, verifiedFaq.content);
  assert.equal(result.recalledTurns, 0);

  const draftResult = await runEmployeeSandbox(employee, "When are you open?", [
    { ...verifiedFaq, verified: false },
  ]);
  assert.equal(draftResult.ok, true);
  if (!draftResult.ok) return;
  assert.equal(draftResult.provider, "Safe mock");
});

test("structured mode excludes legacy notes and unverified entries from AI context", () => {
  const context = buildEmployeeSandboxContext(
    employee,
    "What services do you offer?",
    [
      { ...verifiedFaq, kind: "note", title: "Services", question: "", content: "Verified service list." },
      { ...verifiedFaq, id: "55555555-5555-4555-8555-555555555555", verified: false, content: "Draft secret." },
    ],
    true,
  );

  assert.match(context.knowledgeNotes, /Verified service list/);
  assert.doesNotMatch(context.knowledgeNotes, /Appointments are available/);
  assert.doesNotMatch(context.knowledgeNotes, /Draft secret/);
});

test("parseSandboxRecentMessages trims, bounds, and splits turns per line", () => {
  assert.deepEqual(parseSandboxRecentMessages(null), []);
  assert.deepEqual(parseSandboxRecentMessages("   "), []);
  assert.deepEqual(parseSandboxRecentMessages(42), []);
  assert.deepEqual(
    parseSandboxRecentMessages("  Are you open Friday? \n\n Yes, we are.  \n"),
    ["Are you open Friday?", "Yes, we are."],
  );
});

test("parseSandboxRecentMessages caps the turn count and per-turn length", () => {
  const manyTurns = Array.from({ length: 8 }, (_, i) => `turn ${i}`).join("\n");
  assert.equal(parseSandboxRecentMessages(manyTurns).length, 5);

  const hugeTurn = "x".repeat(2000);
  assert.equal(parseSandboxRecentMessages(hugeTurn)[0]!.length, 500);
});

test("runEmployeeSandbox forwards recent turns so the mock recalls them", async () => {
  const withMemory = await runEmployeeSandbox(
    employee,
    "hello!",
    [],
    false,
    ["Do you have openings on Friday?"],
  );
  assert.equal(withMemory.ok, true);
  if (!withMemory.ok) return;
  assert.match(withMemory.reply, /Hi again/);
  assert.equal(withMemory.recalledTurns, 1);

  const withoutMemory = await runEmployeeSandbox(employee, "hello!");
  assert.equal(withoutMemory.ok, true);
  if (!withoutMemory.ok) return;
  assert.equal(withoutMemory.reply, "Welcome to Bright Dental!");
  assert.equal(withoutMemory.recalledTurns, 0);
});
