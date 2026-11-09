/**
 * Phase B B5 memory user-approved facts service tests (M3).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryUserApprovedFactsService } from "./memoryUserApprovedFactsService.ts";
import { createInMemoryMemoryStore } from "./memoryStore.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore() {
  return createInMemoryMemoryStore({ now: () => FIXED_NOW });
}

test("upsertFact creates a fact with consent", async () => {
  const store = makeStore();
  const service = createMemoryUserApprovedFactsService(store);
  const consentResult = await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(consentResult.ok, true);

  const result = await service.upsertFact({
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

test("upsertFact requires consent", async () => {
  const store = makeStore();
  const service = createMemoryUserApprovedFactsService(store);
  const result = await service.upsertFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
    factValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    consentRecordId: "nonexistent",
    expiresAt: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "consent_not_found_or_revoked");
});

test("getFacts returns only active facts", async () => {
  const store = makeStore();
  const service = createMemoryUserApprovedFactsService(store);
  const consentResult = await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(consentResult.ok, true);

  await service.upsertFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
    factValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    consentRecordId: consentResult.value.consentId,
    expiresAt: null,
  });

  const facts = await service.getFacts("ws-1");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].factKey, "fact-1");
});

test("deleteFact soft-deletes a fact", async () => {
  const store = makeStore();
  const service = createMemoryUserApprovedFactsService(store);
  const consentResult = await store.recordMemoryConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(consentResult.ok, true);

  await service.upsertFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
    factValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    consentRecordId: consentResult.value.consentId,
    expiresAt: null,
  });

  const deleted = await service.deleteFact({
    workspaceId: "ws-1",
    factKey: "fact-1",
  });
  assert.equal(deleted.ok, true);

  const facts = await service.getFacts("ws-1");
  assert.equal(facts.length, 0);
});
