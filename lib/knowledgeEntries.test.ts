import assert from "node:assert/strict";
import test from "node:test";

import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  findVerifiedFaqAnswer,
  formatVerifiedKnowledge,
  isValidKnowledgeId,
  listKnowledgeEntries,
  updateKnowledgeEntry,
  validateKnowledgeEntryInput,
  type KnowledgeEntry,
} from "./knowledgeEntries.ts";

const employeeId = "11111111-1111-4111-8111-111111111111";
const entryId = "22222222-2222-4222-8222-222222222222";
const baseEntry: KnowledgeEntry = {
  id: entryId,
  workspace_id: "33333333-3333-4333-8333-333333333333",
  ai_employee_id: employeeId,
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

function queryClient(finalResult: unknown) {
  const calls: Array<[string, unknown]> = [];
  const builder = {
    select(value?: string) { calls.push(["select", value]); return builder; },
    eq(field: string, value: unknown) { calls.push([`eq:${field}`, value]); return builder; },
    order(field: string, value: unknown) { calls.push([`order:${field}`, value]); return builder; },
    limit: async (value: number) => (calls.push(["limit", value]), finalResult),
    insert(value: unknown) { calls.push(["insert", value]); return builder; },
    update(value: unknown) { calls.push(["update", value]); return builder; },
    delete() { calls.push(["delete", true]); return builder; },
    single: async () => finalResult,
    then(resolve: (value: unknown) => unknown) { return Promise.resolve(finalResult).then(resolve); },
  };
  return {
    calls,
    client: {
      from: (table: string) => (calls.push(["from", table]), builder),
      rpc: async (name: string, args: unknown) => (calls.push([`rpc:${name}`, args]), finalResult),
    } as never,
  };
}

test("knowledge validation enforces type and bounded required fields", () => {
  assert.equal(validateKnowledgeEntryInput({ kind: "faq", title: "Hours", question: "When?", content: "Weekdays", verified: true }), null);
  assert.equal(validateKnowledgeEntryInput({ kind: "faq", title: "Hours", question: "", content: "Weekdays", verified: true }), "FAQ question is required.");
  assert.equal(validateKnowledgeEntryInput({ kind: "note", title: "", content: "Text", verified: false }), "Knowledge title is required.");
  assert.equal(validateKnowledgeEntryInput({ kind: "note", title: "Note", content: "", verified: false }), "Knowledge answer or note is required.");
  assert.equal(isValidKnowledgeId(employeeId), true);
  assert.equal(isValidKnowledgeId("bad"), false);
});

test("knowledge list is employee-scoped, newest-first, and bounded", async () => {
  const fake = queryClient({ data: [baseEntry], error: null });
  assert.deepEqual(await listKnowledgeEntries(fake.client, employeeId, 20), { data: [baseEntry], error: null });
  assert.ok(fake.calls.some(([name, value]) => name === "eq:ai_employee_id" && value === employeeId));
  assert.deepEqual(fake.calls.at(-1), ["limit", 20]);
});

test("knowledge create and update normalize fields without accepting identity fields", async () => {
  const created = queryClient({ data: baseEntry, error: null });
  const input = { kind: "faq" as const, title: " Hours ", question: " When are you open? ", content: " Weekdays ", verified: true };
  assert.deepEqual(await createKnowledgeEntry(created.client, employeeId, input), { data: baseEntry, error: null });
  assert.ok(created.calls.some(([name, value]) => name === "rpc:create_knowledge_entry" && (value as { target_employee_id?: string }).target_employee_id === employeeId));

  const updated = queryClient({ data: baseEntry, error: null });
  assert.deepEqual(await updateKnowledgeEntry(updated.client, employeeId, entryId, input), { data: baseEntry, error: null });
  assert.ok(updated.calls.some(([name, value]) => name === "eq:id" && value === entryId));
  assert.ok(updated.calls.some(([name, value]) => name === "eq:ai_employee_id" && value === employeeId));
});

test("knowledge delete is scoped by both employee and entry identifiers", async () => {
  const fake = queryClient({ error: null });
  assert.deepEqual(await deleteKnowledgeEntry(fake.client, employeeId, entryId), { error: null });
  assert.ok(fake.calls.some(([name]) => name === "delete"));
  assert.ok(fake.calls.some(([name, value]) => name === "eq:ai_employee_id" && value === employeeId));
  assert.deepEqual(await deleteKnowledgeEntry(fake.client, "bad", entryId), { error: "Invalid knowledge entry." });
});

test("only verified entries enter bounded AI context", () => {
  const context = formatVerifiedKnowledge([
    baseEntry,
    { ...baseEntry, id: "55555555-5555-4555-8555-555555555555", title: "Draft", content: "Do not use", verified: false },
  ]);
  assert.match(context, /When are you open/);
  assert.match(context, /Monday to Friday/);
  assert.doesNotMatch(context, /Do not use/);
});

test("verified FAQ matching is deterministic and ignores drafts or unrelated questions", () => {
  assert.equal(findVerifiedFaqAnswer([baseEntry], "Hi, when are you open?"), baseEntry.content);
  assert.equal(findVerifiedFaqAnswer([{ ...baseEntry, verified: false }], "When are you open?"), null);
  assert.equal(findVerifiedFaqAnswer([baseEntry], "Do you provide refunds?"), null);
});
