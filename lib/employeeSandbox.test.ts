import assert from "node:assert/strict";
import test from "node:test";

import {
  SANDBOX_INPUT_MAX_LENGTH,
  SANDBOX_OUTPUT_MAX_LENGTH,
  buildEmployeeSandboxContext,
  isValidSandboxEmployeeId,
  runEmployeeSandbox,
  validateSandboxCustomerMessage,
  type SandboxEmployee,
} from "./employeeSandbox.ts";

const employee: SandboxEmployee = {
  name: " Ava ",
  business_name: " Bright Dental ",
  greeting_message: " Welcome to Bright Dental! ",
  knowledge_notes: " Appointments are available Monday to Friday. ",
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
