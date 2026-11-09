/**
 * Phase B B5 memory consent service tests.
 *
 * M3 user-approved persistent memory requires explicit consent. Consent
 * missing ⇒ not stored. Consent records are auditable.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryConsentService } from "./memoryConsentService.ts";
import { createInMemoryMemoryStore } from "./memoryStore.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore() {
  return createInMemoryMemoryStore({ now: () => FIXED_NOW });
}

test("recordMemoryConsent records a consent", async () => {
  const store = makeStore();
  const service = createMemoryConsentService(store);
  const result = await service.recordConsent({
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

test("hasConsent returns true when consent is granted", async () => {
  const store = makeStore();
  const service = createMemoryConsentService(store);
  await service.recordConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  const hasConsent = await service.hasConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(hasConsent, true);
});

test("hasConsent returns false when no consent exists", async () => {
  const store = makeStore();
  const service = createMemoryConsentService(store);
  const hasConsent = await service.hasConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(hasConsent, false);
});

test("revokeConsent revokes a granted consent", async () => {
  const store = makeStore();
  const service = createMemoryConsentService(store);
  await service.recordConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });

  const revoked = await service.revokeConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(revoked.ok, true);

  const hasConsent = await service.hasConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert.equal(hasConsent, false);
});

test("getConsentRecords returns consent records", async () => {
  const store = makeStore();
  const service = createMemoryConsentService(store);
  await service.recordConsent({
    workspaceId: "ws-1",
    userId: "user-1",
    consentType: "m3_persistent_memory",
    granted: true,
    evidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  });

  const records = await service.getConsentRecords("ws-1", "user-1");
  assert.equal(records.length, 1);
  assert.equal(records[0].consentType, "m3_persistent_memory");
  assert.equal(records[0].granted, true);
});
