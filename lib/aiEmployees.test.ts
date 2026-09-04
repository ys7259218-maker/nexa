import assert from "node:assert/strict";
import test from "node:test";

import {
  createAIEmployee,
  deleteAIEmployee,
  getAIEmployee,
  identityFieldCompleteness,
  IDENTITY_FIELDS,
  knowledgeSourceCount,
  KNOWLEDGE_FIELDS,
  listAIEmployees,
  phoneFieldCompleteness,
  PHONE_FIELDS,
  updateAIEmployee,
  validateAIEmployeeInput,
  voiceFieldCompleteness,
  VOICE_FIELDS,
  type AIEmployee,
} from "./aiEmployees.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type TerminalResult = {
  data?: unknown;
  error?: { message: string } | null;
};

class FakeQuery {
  calls: Array<{ method: string; args: unknown }> = [];

  private readonly result: TerminalResult;

  constructor(result: TerminalResult) {
    this.result = result;
  }

  #record(method: string, args?: unknown): this {
    this.calls.push({ method, args });
    return this;
  }

  select(args?: unknown) {
    return this.#record("select", args);
  }

  order(column: string, options?: unknown) {
    return this.#record("order", { column, options });
  }

  eq(column: string, value: unknown) {
    return this.#record("eq", { column, value });
  }

  insert(payload: unknown) {
    return this.#record("insert", payload);
  }

  update(payload: unknown) {
    return this.#record("update", payload);
  }

  delete() {
    return this.#record("delete");
  }

  maybeSingle() {
    this.#record("maybeSingle");
    return Promise.resolve({
      data: this.result.data ?? null,
      error: this.result.error ?? null,
    });
  }

  single() {
    this.#record("single");
    return Promise.resolve({
      data: this.result.data ?? null,
      error: this.result.error ?? null,
    });
  }

  then(
    resolve: (value: { data: unknown; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) {
    return Promise.resolve({
      data: this.result.data ?? null,
      error: this.result.error ?? null,
    }).then(resolve, reject);
  }
}

function createFakeClient(result: TerminalResult) {
  const queries: FakeQuery[] = [];
  let table = "";

  const client = {
    from(selectedTable: string) {
      table = selectedTable;
      const query = new FakeQuery(result);
      queries.push(query);
      return query;
    },
  } as unknown as SupabaseClient;

  return {
    client,
    getTable: () => table,
    getCalls: () => queries.flatMap((query) => query.calls),
  };
}

const sampleEmployee: AIEmployee = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: "22222222-2222-2222-2222-222222222222",
  name: "Nexa Receptionist",
  business_name: "Acme Plumbing",
  phone: "+15550001111",
  voice: "Female",
  language: "English",
  status: "Offline",
  department: "",
  business_description: "",
  greeting_message: "",
  timezone: "",
  working_hours: "",
  accent: "",
  speaking_style: "",
  speaking_speed: "",
  tone: "",
  country: "",
  business_hours: "",
  call_forwarding_number: "",
  call_routing_rule: "",
  knowledge_website: "",
  knowledge_faq_document: "",
  knowledge_pdf_url: "",
  knowledge_notes: "",
  created_at: "2026-01-01T00:00:00Z",
};

test("validateAIEmployeeInput enforces schema limits", () => {
  assert.equal(validateAIEmployeeInput({ name: "", business_name: "Acme" }), "AI Employee Name is required.");
  assert.equal(
    validateAIEmployeeInput({ name: "Nexa", business_name: "" }),
    "Business Name is required.",
  );
  assert.equal(
    validateAIEmployeeInput({ name: "a".repeat(101), business_name: "Acme" }),
    "AI Employee Name must be at most 100 characters.",
  );
  assert.equal(
    validateAIEmployeeInput({ name: "Nexa", business_name: "b".repeat(161) }),
    "Business Name must be at most 160 characters.",
  );
  assert.equal(validateAIEmployeeInput({ name: " Nexa ", business_name: " Acme " }), null);
});

test("createAIEmployee inserts trimmed values with defaults into ai_employees", async () => {
  const fake = createFakeClient({ data: sampleEmployee });

  const result = await createAIEmployee(fake.client, {
    name: " Nexa ",
    business_name: " Acme ",
  });

  assert.deepEqual(result, { data: sampleEmployee, error: null });
  assert.equal(fake.getTable(), "ai_employees");

  const insertCall = fake.getCalls().find((call) => call.method === "insert");
  assert.deepEqual(insertCall?.args, {
    name: "Nexa",
    business_name: "Acme",
    phone: "",
    voice: "Female",
    language: "English",
    status: "Offline",
  });
  assert.ok(fake.getCalls().some((call) => call.method === "single"));
});

test("createAIEmployee rejects invalid input without querying the database", async () => {
  const fake = createFakeClient({ data: sampleEmployee });

  const result = await createAIEmployee(fake.client, {
    name: "",
    business_name: "Acme",
  });

  assert.deepEqual(result, { data: null, error: "AI Employee Name is required." });
  assert.equal(fake.getCalls().length, 0);
});

test("listAIEmployees orders by created_at descending and defaults to an empty list", async () => {
  const fake = createFakeClient({ data: [sampleEmployee] });

  const result = await listAIEmployees(fake.client);

  assert.deepEqual(result, { data: [sampleEmployee], error: null });

  const orderCall = fake.getCalls().find((call) => call.method === "order");
  assert.deepEqual(orderCall?.args, {
    column: "created_at",
    options: { ascending: false },
  });

  const emptyFake = createFakeClient({ data: null });
  const emptyResult = await listAIEmployees(emptyFake.client);
  assert.deepEqual(emptyResult, { data: [], error: null });
});

test("getAIEmployee filters by id and tolerates missing rows", async () => {
  const foundFake = createFakeClient({ data: sampleEmployee });
  const found = await getAIEmployee(foundFake.client, sampleEmployee.id);
  assert.deepEqual(found, { data: sampleEmployee, error: null });

  const eqCall = foundFake.getCalls().find((call) => call.method === "eq");
  assert.deepEqual(eqCall?.args, { column: "id", value: sampleEmployee.id });
  assert.ok(foundFake.getCalls().some((call) => call.method === "maybeSingle"));

  const missingFake = createFakeClient({ data: null });
  const missing = await getAIEmployee(missingFake.client, sampleEmployee.id);
  assert.deepEqual(missing, { data: null, error: null });
});

test("updateAIEmployee only sends provided fields and rejects no-op updates", async () => {
  const updated = { ...sampleEmployee, name: "Renamed" };
  const fake = createFakeClient({ data: updated });

  const result = await updateAIEmployee(fake.client, sampleEmployee.id, {
    name: " Renamed ",
  });

  assert.deepEqual(result, { data: updated, error: null });

  const updateCall = fake.getCalls().find((call) => call.method === "update");
  assert.deepEqual(updateCall?.args, { name: "Renamed" });

  const eqCall = fake.getCalls().find((call) => call.method === "eq");
  assert.deepEqual(eqCall?.args, { column: "id", value: sampleEmployee.id });

  const noopFake = createFakeClient({ data: updated });
  const noopResult = await updateAIEmployee(noopFake.client, sampleEmployee.id, {});
  assert.deepEqual(noopResult, { data: null, error: "Nothing to update." });
});

test("updateAIEmployee persists trimmed settings metadata", async () => {
  const updated = {
    ...sampleEmployee,
    greeting_message: "Hello!",
    knowledge_notes: "  Family business since 1990.  ",
  };
  const fake = createFakeClient({ data: updated });

  const result = await updateAIEmployee(fake.client, sampleEmployee.id, {
    greeting_message: " Hello! ",
    knowledge_notes: "  Family business since 1990.  ",
  });

  assert.deepEqual(result, { data: updated, error: null });

  const updateCall = fake.getCalls().find((call) => call.method === "update");
  assert.deepEqual(updateCall?.args, {
    greeting_message: "Hello!",
    knowledge_notes: "Family business since 1990.",
  });
});

test("validateAIEmployeeInput caps settings metadata lengths", () => {
  assert.equal(
    validateAIEmployeeInput({ department: "d".repeat(201) }),
    "department must be at most 200 characters.",
  );
  assert.equal(
    validateAIEmployeeInput({ knowledge_notes: "n".repeat(501) }),
    "knowledge notes must be at most 500 characters.",
  );
  assert.equal(validateAIEmployeeInput({ accent: "Neutral" }), null);
});

test("deleteAIEmployee deletes by id and surfaces errors", async () => {
  const fake = createFakeClient({ data: null });

  const result = await deleteAIEmployee(fake.client, sampleEmployee.id);

  assert.deepEqual(result, { data: true, error: null });

  const deleteCall = fake.getCalls().find((call) => call.method === "delete");
  assert.ok(deleteCall);

  const eqCall = fake.getCalls().find((call) => call.method === "eq");
  assert.deepEqual(eqCall?.args, { column: "id", value: sampleEmployee.id });

  const failingFake = createFakeClient({
    error: { message: "row-level security violation" },
  });
  const failure = await deleteAIEmployee(failingFake.client, sampleEmployee.id);
  assert.deepEqual(failure, {
    data: null,
    error: "row-level security violation",
  });
});

test("knowledgeSourceCount spans the four reference fields", () => {
  assert.equal(KNOWLEDGE_FIELDS.length, 4);
  assert.equal(
    knowledgeSourceCount({
      knowledge_website: "https://example.com",
      knowledge_faq_document: "",
      knowledge_pdf_url: "   ",
      knowledge_notes: "Notes",
    }),
    2,
  );
  assert.equal(
    knowledgeSourceCount({
      knowledge_website: "",
      knowledge_faq_document: "",
      knowledge_pdf_url: "",
      knowledge_notes: "",
    }),
    0,
  );
  assert.equal(
    knowledgeSourceCount({
      knowledge_website: "https://a.com",
      knowledge_faq_document: "faq",
      knowledge_pdf_url: "pdf",
      knowledge_notes: "notes",
    }),
    4,
  );
});

test("identityFieldCompleteness counts the three identity fields", () => {
  assert.equal(IDENTITY_FIELDS.length, 3);
  assert.deepEqual(
    identityFieldCompleteness({ name: "Nexa", business_name: "   ", department: "" }),
    { filled: 1, total: 3 },
  );
  assert.deepEqual(
    identityFieldCompleteness({ name: "", business_name: "", department: "" }),
    { filled: 0, total: 3 },
  );
  assert.deepEqual(
    identityFieldCompleteness({ name: "Nexa", business_name: "Acme", department: "Support" }),
    { filled: 3, total: 3 },
  );
});

test("voiceFieldCompleteness counts the six voice preference fields", () => {
  assert.equal(VOICE_FIELDS.length, 6);
  assert.deepEqual(
    voiceFieldCompleteness({
      voice: "Female",
      language: "English",
      accent: "",
      speaking_style: "   ",
      speaking_speed: "",
      tone: "",
    }),
    { filled: 2, total: 6 },
  );
  assert.deepEqual(
    voiceFieldCompleteness({
      voice: "",
      language: "",
      accent: "",
      speaking_style: "",
      speaking_speed: "",
      tone: "",
    }),
    { filled: 0, total: 6 },
  );
  assert.deepEqual(
    voiceFieldCompleteness({
      voice: "Female",
      language: "English",
      accent: "American",
      speaking_style: "Formal",
      speaking_speed: "Normal",
      tone: "Friendly",
    }),
    { filled: 6, total: 6 },
  );
});

test("phoneFieldCompleteness counts the five phone metadata fields", () => {
  assert.equal(PHONE_FIELDS.length, 5);
  assert.deepEqual(
    phoneFieldCompleteness({
      phone: "+15550001111",
      country: "",
      business_hours: "9-5",
      call_forwarding_number: "",
      call_routing_rule: "   ",
    }),
    { filled: 2, total: 5 },
  );
  assert.deepEqual(
    phoneFieldCompleteness({
      phone: "",
      country: "",
      business_hours: "",
      call_forwarding_number: "",
      call_routing_rule: "",
    }),
    { filled: 0, total: 5 },
  );
  assert.deepEqual(
    phoneFieldCompleteness({
      phone: "+15550001111",
      country: "US",
      business_hours: "9-5",
      call_forwarding_number: "+15550002222",
      call_routing_rule: "Sales first",
    }),
    { filled: 5, total: 5 },
  );
});
