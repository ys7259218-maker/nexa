import assert from "node:assert/strict";
import test from "node:test";

import {
  KNOWLEDGE_SOURCE_FILE_MAX_BYTES,
  createKnowledgeSource,
  deleteKnowledgeSource,
  listKnowledgeSources,
  listKnowledgeSourceDeletionReceipts,
  markKnowledgeSourceReviewed,
  normalizePublicHttpsUrl,
  validateKnowledgeSourceInput,
  type KnowledgeSource,
} from "./knowledgeSources.ts";

const employeeId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const source: KnowledgeSource = {
  id: sourceId,
  workspace_id: "33333333-3333-4333-8333-333333333333",
  ai_employee_id: employeeId,
  kind: "website",
  label: "Public help center",
  website_url: "https://docs.example.com/help",
  file_name: "",
  file_media_type: "",
  file_size_bytes: null,
  created_by: "44444444-4444-4444-8444-444444444444",
  created_at: "2026-08-29T00:00:00.000Z",
  reviewed_at: null,
  review_due_at: null,
  reviewed_by: null,
};

function queryClient(finalResult: unknown) {
  const calls: Array<[string, unknown]> = [];
  const builder = {
    select(value?: string) { calls.push(["select", value]); return builder; },
    eq(field: string, value: unknown) { calls.push([`eq:${field}`, value]); return builder; },
    order(field: string, value: unknown) { calls.push([`order:${field}`, value]); return builder; },
    limit: async (value: number) => (calls.push(["limit", value]), finalResult),
    delete() { calls.push(["delete", true]); return builder; },
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

test("website references require normalized public HTTPS URLs", () => {
  assert.equal(normalizePublicHttpsUrl(" https://docs.example.com/help "), "https://docs.example.com/help");
  for (const unsafe of [
    "http://example.com",
    "https://localhost/help",
    "https://127.0.0.1/help",
    "https://user:pass@example.com/help",
    "https://example.com:8443/help",
    "https://example.com/help#private-fragment",
  ]) {
    assert.equal(normalizePublicHttpsUrl(unsafe), null, unsafe);
  }
  assert.equal(validateKnowledgeSourceInput({ kind: "website", label: "Docs", websiteUrl: "https://docs.example.com" }), null);
});

test("file references accept only matching bounded PDF or TXT metadata", () => {
  assert.equal(validateKnowledgeSourceInput({
    kind: "file",
    label: "Price list",
    fileName: "prices.pdf",
    fileMediaType: "application/pdf",
    fileSizeBytes: 1024,
  }), null);
  assert.match(validateKnowledgeSourceInput({
    kind: "file",
    label: "Wrong",
    fileName: "notes.txt",
    fileMediaType: "application/pdf",
    fileSizeBytes: 10,
  })!, /matching PDF/);
  assert.match(validateKnowledgeSourceInput({
    kind: "file",
    label: "Path",
    fileName: "../notes.txt",
    fileMediaType: "text/plain",
    fileSizeBytes: 10,
  })!, /plain file name/);
  assert.match(validateKnowledgeSourceInput({
    kind: "file",
    label: "Large",
    fileName: "notes.txt",
    fileMediaType: "text/plain",
    fileSizeBytes: KNOWLEDGE_SOURCE_FILE_MAX_BYTES + 1,
  })!, /between 1 byte/);
});

test("source list, guarded deletion, and receipts remain employee-scoped", async () => {
  const listed = queryClient({ data: [source], error: null });
  assert.deepEqual(await listKnowledgeSources(listed.client, employeeId, 20), { data: [source], error: null });
  assert.ok(listed.calls.some(([name, value]) => name === "eq:ai_employee_id" && value === employeeId));

  const receipt = { id: sourceId, ai_employee_id: employeeId };
  const removed = queryClient({ data: receipt, error: null });
  assert.deepEqual(await deleteKnowledgeSource(removed.client, employeeId, sourceId), { data: receipt, error: null });
  assert.deepEqual(removed.calls.find(([name]) => name === "rpc:delete_knowledge_source")?.[1], {
    target_employee_id: employeeId, target_source_id: sourceId,
  });

  const receipts = queryClient({ data: [receipt], error: null });
  assert.deepEqual((await listKnowledgeSourceDeletionReceipts(receipts.client, employeeId)).data, [receipt]);
  assert.ok(receipts.calls.some(([name, value]) => name === "eq:ai_employee_id" && value === employeeId));
});

test("manual freshness review is bounded and uses only the guarded RPC", async () => {
  const reviewed = { ...source, reviewed_at: "2026-08-29T01:00:00.000Z", review_due_at: "2026-11-27T01:00:00.000Z" };
  const fake = queryClient({ data: reviewed, error: null });
  assert.deepEqual(await markKnowledgeSourceReviewed(fake.client, employeeId, sourceId, 90), { data: reviewed, error: null });
  assert.deepEqual(fake.calls.find(([name]) => name === "rpc:mark_knowledge_source_reviewed")?.[1], {
    target_employee_id: employeeId, target_source_id: sourceId, review_due_days: 90,
  });
  assert.match((await markKnowledgeSourceReviewed(fake.client, employeeId, sourceId, 0)).error!, /1 through 365/);
});

test("source creation sends normalized metadata only through the guarded RPC", async () => {
  const fake = queryClient({ data: source, error: null });
  const result = await createKnowledgeSource(fake.client, employeeId, {
    kind: "website",
    label: " Docs ",
    websiteUrl: "https://docs.example.com/help",
  });
  assert.deepEqual(result, { data: source, error: null });
  const call = fake.calls.find(([name]) => name === "rpc:create_knowledge_source");
  assert.ok(call);
  assert.deepEqual(call![1], {
    target_employee_id: employeeId,
    source_kind: "website",
    source_label: "Docs",
    source_website_url: "https://docs.example.com/help",
    source_file_name: "",
    source_file_media_type: "",
    source_file_size_bytes: null,
  });
  assert.doesNotMatch(JSON.stringify(call![1]), /content|body|upload|embedding/i);
});
