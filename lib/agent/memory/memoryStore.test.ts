/**
 * Phase B B5 memory store tests.
 *
 * In-memory store with validation. Content-free hashes only — never raw
 * content or plaintext secrets.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryMemoryStore,
  type MemoryStore,
} from "./memoryStore.ts";
import type { MemoryConsentType } from "./memoryTypes.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore(): MemoryStore {
  return createInMemoryMemoryStore({ now: () => FIXED_NOW });
}

async function upsertScratchpad(
  store: MemoryStore,
  workspaceId: string,
  taskId: string,
  scratchpadKey: string,
) {
  return store.upsertMemorySessionScratchpad({
    workspaceId,
    taskId,
    scratchpadKey,
    scratchpadValue: { key: "value" },
    ttlSeconds: 3600,
  });
}

test("upsertMemorySessionScratchpad creates a scratchpad", async () => {
  const store = makeStore();
  const result = await upsertScratchpad(store, "ws-1", "task-1", "key-1");
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.scratchpadId.length > 0, true);
});

test("upsertMemorySessionScratchpad is idempotent on (workspace, task, key)", async () => {
  const store = makeStore();
  const first = await upsertScratchpad(store, "ws-1", "task-1", "key-1");
  assert.equal(first.ok, true);

  const second = await store.upsertMemorySessionScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
    scratchpadValue: { key: "updated" },
    ttlSeconds: 7200,
  });
  assert.equal(second.ok, true);

  const scratchpads = await store.listMemorySessionScratchpads("ws-1", "task-1");
  assert.equal(scratchpads.length, 1);
  assert.equal(scratchpads[0].scratchpadKey, "key-1");
});

test("getMemorySessionScratchpad returns null when no scratchpad exists", async () => {
  const store = makeStore();
  const scratchpad = await store.getMemorySessionScratchpad(
    "ws-1",
    "task-1",
    "key-1",
  );
  assert.equal(scratchpad, null);
});

test("getMemorySessionScratchpad returns the active scratchpad", async () => {
  const store = makeStore();
  await upsertScratchpad(store, "ws-1", "task-1", "key-1");

  const scratchpad = await store.getMemorySessionScratchpad(
    "ws-1",
    "task-1",
    "key-1",
  );
  assert.equal(scratchpad?.workspaceId, "ws-1");
  assert.equal(scratchpad?.taskId, "task-1");
  assert.equal(scratchpad?.scratchpadKey, "key-1");
});

test("listMemorySessionScratchpads returns only workspace-scoped scratchpads", async () => {
  const store = makeStore();
  await upsertScratchpad(store, "ws-1", "task-1", "key-1");
  await upsertScratchpad(store, "ws-2", "task-2", "key-2");

  const ws1Scratchpads = await store.listMemorySessionScratchpads("ws-1");
  assert.equal(ws1Scratchpads.length, 1);
  assert.equal(ws1Scratchpads[0].workspaceId, "ws-1");

  const ws2Scratchpads = await store.listMemorySessionScratchpads("ws-2");
  assert.equal(ws2Scratchpads.length, 1);
  assert.equal(ws2Scratchpads[0].workspaceId, "ws-2");
});

test("deleteMemorySessionScratchpad deletes a scratchpad", async () => {
  const store = makeStore();
  const result = await upsertScratchpad(store, "ws-1", "task-1", "key-1");
  assert.equal(result.ok, true);

  const scratchpad = await store.getMemorySessionScratchpad(
    "ws-1",
    "task-1",
    "key-1",
  );
  assert.equal(scratchpad?.scratchpadKey, "key-1");

  const deleted = await store.deleteMemorySessionScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
  });
  assert.equal(deleted.ok, true);

  const afterDelete = await store.getMemorySessionScratchpad(
    "ws-1",
    "task-1",
    "key-1",
  );
  assert.equal(afterDelete, null);
});

test("deleteMemorySessionScratchpad returns scratchpad_not_found", async () => {
  const store = makeStore();
  const deleted = await store.deleteMemorySessionScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "nonexistent",
  });
  assert.equal(deleted.ok, false);
  assert.equal(deleted.reason, "scratchpad_not_found");
});

test("validation rejects invalid ttlSeconds", async () => {
  const store = makeStore();
  const result = await store.upsertMemorySessionScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
    scratchpadValue: { key: "value" },
    ttlSeconds: 0,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_ttl_seconds");
});

test("validation rejects invalid scratchpad key", async () => {
  const store = makeStore();
  const result = await store.upsertMemorySessionScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "",
    scratchpadValue: { key: "value" },
    ttlSeconds: 3600,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_scratchpad_key");
});

test("upsertMemoryTaskMemory creates a task memory", async () => {
  const store = makeStore();
  const result = await store.upsertMemoryTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.memoryId.length > 0, true);
});

test("getMemoryTaskMemory returns task memories in step order", async () => {
  const store = makeStore();
  await store.upsertMemoryTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 2,
    outputKey: "output-2",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });
  await store.upsertMemoryTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });

  const memories = await store.getMemoryTaskMemory("ws-1", "task-1");
  assert.equal(memories.length, 2);
  assert.equal(memories[0].stepSeq, 1);
  assert.equal(memories[1].stepSeq, 2);
});

test("deleteMemoryTaskMemory deletes a task memory", async () => {
  const store = makeStore();
  await store.upsertMemoryTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });

  const deleted = await store.deleteMemoryTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
  });
  assert.equal(deleted.ok, true);

  const memories = await store.getMemoryTaskMemory("ws-1", "task-1");
  assert.equal(memories.length, 0);
});

test("upsertMemoryUserApprovedFact creates a fact with consent", async () => {
  const store = makeStore();
  const consentResult = await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(consentResult.ok, true);
  if (!consentResult.ok) throw new Error("expected ok");

  const result = await store.upsertMemoryUserApprovedFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
    factValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    consentRecordId: consentResult.value.consentId,
    expiresAt: null,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.factId.length > 0, true);
});

test("upsertMemoryUserApprovedFact requires consent", async () => {
  const store = makeStore();
  const result = await store.upsertMemoryUserApprovedFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
    factValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    consentRecordId: "nonexistent",
    expiresAt: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "consent_not_found_or_revoked");
});

test("getMemoryUserApprovedFacts returns only active facts", async () => {
  const store = makeStore();
  const consentResult = await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(consentResult.ok, true);

  await store.upsertMemoryUserApprovedFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
    factValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    consentRecordId: consentResult.value.consentId,
    expiresAt: null,
  });

  const facts = await store.getMemoryUserApprovedFacts("ws-1");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].factKey, "fact-1");
});

test("deleteMemoryUserApprovedFact soft-deletes a fact", async () => {
  const store = makeStore();
  const consentResult = await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(consentResult.ok, true);

  await store.upsertMemoryUserApprovedFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
    factValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    consentRecordId: consentResult.value.consentId,
    expiresAt: null,
  });

  const deleted = await store.deleteMemoryUserApprovedFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
  });
  assert.equal(deleted.ok, true);

  const facts = await store.getMemoryUserApprovedFacts("ws-1");
  assert.equal(facts.length, 0);
});

test("upsertMemoryExternalDataRef creates a ref", async () => {
  const store = makeStore();
  const result = await store.upsertMemoryExternalDataRef({
    workspaceId: "ws-1",
    refKey: "ref-1",
    refUrl: "https://example.com/data",
    refId: null,
    revalidationWindowSeconds: 3600,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.refId.length > 0, true);
});

test("getMemoryExternalDataRefs returns workspace-scoped refs", async () => {
  const store = makeStore();
  await store.upsertMemoryExternalDataRef({
    workspaceId: "ws-1",
    refKey: "ref-1",
    refUrl: "https://example.com/data",
    refId: null,
    revalidationWindowSeconds: 3600,
  });
  await store.upsertMemoryExternalDataRef({
    workspaceId: "ws-2",
    refKey: "ref-2",
    refUrl: null,
    refId: "ext-2",
    revalidationWindowSeconds: 3600,
  });

  const ws1Refs = await store.getMemoryExternalDataRefs("ws-1");
  assert.equal(ws1Refs.length, 1);
  assert.equal(ws1Refs[0].refKey, "ref-1");

  const ws2Refs = await store.getMemoryExternalDataRefs("ws-2");
  assert.equal(ws2Refs.length, 1);
  assert.equal(ws2Refs[0].refKey, "ref-2");
});

test("deleteMemoryExternalDataRef deletes an external data ref", async () => {
  const store = makeStore();
  await store.upsertMemoryExternalDataRef({
    workspaceId: "ws-1",
    refKey: "ref-1",
    refUrl: "https://example.com/data",
    refId: null,
    revalidationWindowSeconds: 3600,
  });

  const deleted = await store.deleteMemoryExternalDataRef({
    workspaceId: "ws-1",
    refKey: "ref-1",
  });
  assert.equal(deleted.ok, true);

  const refs = await store.getMemoryExternalDataRefs("ws-1");
  assert.equal(refs.length, 0);
});

test("recordMemoryConsent creates a consent record", async () => {
  const store = makeStore();
  const result = await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.consentId.length > 0, true);
});

test("getMemoryConsentRecords returns workspace-scoped consents", async () => {
  const store = makeStore();
  await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  await store.recordMemoryConsent({
    workspaceId: "ws-2",
    userId: "user-2",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });

  const ws1Consents = await store.getMemoryConsentRecords("ws-1", "user-1");
  assert.equal(ws1Consents.length, 1);
  assert.equal(ws1Consents[0].userId, "user-1");

  const ws2Consents = await store.getMemoryConsentRecords("ws-2", "user-2");
  assert.equal(ws2Consents.length, 1);
  assert.equal(ws2Consents[0].userId, "user-2");
});
