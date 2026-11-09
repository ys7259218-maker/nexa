/**
 * Phase B B3 permission store tests.
 *
 * In-memory store with validation. Content-free hashes only — never raw
 * content or plaintext secrets.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryPermissionStore,
  type PermissionStore,
} from "./permissionStore.ts";
import {
  type PermissionGrant,
  type PermissionTier,
  isPermissionTier,
} from "./permissionTypes.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore(): PermissionStore {
  return createInMemoryPermissionStore({
    now: () => FIXED_NOW,
  });
}

async function upsertGrant(
  store: PermissionStore,
  workspaceId: string,
  tier: PermissionTier,
  toolFamily: string,
) {
  return store.upsertGrant({
    workspaceId,
    tier,
    toolFamily,
    grantedBy: null,
    scopeNotes: null,
    expiresAt: null,
  });
}

test("upsertGrant creates a grant", async () => {
  const store = makeStore();
  const result = await upsertGrant(store, "ws-1", "T2", "web.research.search");
  assert.equal(result.ok, true);
  assert.equal(result.value.grantId.length > 0, true);
});

test("upsertGrant is idempotent on (workspace, tier, toolFamily)", async () => {
  const store = makeStore();
  const first = await upsertGrant(store, "ws-1", "T2", "web.research.search");
  assert.equal(first.ok, true);

  const second = await store.upsertGrant({
    workspaceId: "ws-1",
    tier: "T2",
    toolFamily: "web.research.search",
    grantedBy: "11111111-1111-1111-1111-111111111111",
    scopeNotes: "test",
    expiresAt: null,
  });
  assert.equal(second.ok, true);

  const grants = await store.listGrants("ws-1");
  assert.equal(grants.length, 1);
  assert.equal(grants[0].grantedBy, "11111111-1111-1111-1111-111111111111");
  assert.equal(grants[0].scopeNotes, "test");
});

test("getGrant returns null when no grant exists", async () => {
  const store = makeStore();
  const grant = await store.getGrant("ws-1", "T2", "web.research.search");
  assert.equal(grant, null);
});

test("getGrant returns the active grant", async () => {
  const store = makeStore();
  await upsertGrant(store, "ws-1", "T2", "web.research.search");

  const grant = await store.getGrant("ws-1", "T2", "web.research.search");
  assert.equal(grant?.workspaceId, "ws-1");
  assert.equal(grant?.tier, "T2");
  assert.equal(grant?.toolFamily, "web.research.search");
});

test("listGrants returns only workspace-scoped grants", async () => {
  const store = makeStore();
  await upsertGrant(store, "ws-1", "T2", "web.research.search");
  await upsertGrant(store, "ws-2", "T3", "calendar.events.read");

  const ws1Grants = await store.listGrants("ws-1");
  assert.equal(ws1Grants.length, 1);
  assert.equal(ws1Grants[0].workspaceId, "ws-1");

  const ws2Grants = await store.listGrants("ws-2");
  assert.equal(ws2Grants.length, 1);
  assert.equal(ws2Grants[0].workspaceId, "ws-2");
});

test("revokeGrant removes a grant", async () => {
  const store = makeStore();
  await upsertGrant(store, "ws-1", "T2", "web.research.search");

  const revoked = await store.revokeGrant("ws-1", "T2", "web.research.search");
  assert.equal(revoked.ok, true);
  if (revoked.ok) {
    assert.equal(revoked.value.revokedId !== null, true);
  }

  const grant = await store.getGrant("ws-1", "T2", "web.research.search");
  assert.equal(grant, null);
});

test("revokeGrant returns grant_not_found when no grant exists", async () => {
  const store = makeStore();
  const revoked = await store.revokeGrant("ws-1", "T2", "web.research.search");
  assert.equal(revoked.ok, false);
  assert.equal(revoked.reason, "grant_not_found");
});

test("validation rejects invalid tier", async () => {
  const store = makeStore();
  const result = await store.upsertGrant({
    workspaceId: "ws-1",
    tier: "T9" as PermissionTier,
    toolFamily: "web.research.search",
    grantedBy: null,
    scopeNotes: null,
    expiresAt: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_tier");
});

test("validation rejects invalid tool family", async () => {
  const store = makeStore();
  const result = await store.upsertGrant({
    workspaceId: "ws-1",
    tier: "T2",
    toolFamily: "Invalid.Family",
    grantedBy: null,
    scopeNotes: null,
    expiresAt: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_tool_family");
});

test("validation rejects expired grant", async () => {
  const store = makeStore();
  const result = await store.upsertGrant({
    workspaceId: "ws-1",
    tier: "T2",
    toolFamily: "web.research.search",
    grantedBy: null,
    scopeNotes: null,
    expiresAt: "2020-01-01T00:00:00Z",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "expired_grant_not_allowed");
});

test("isPermissionTier validates tier values", () => {
  assert.equal(isPermissionTier("T0"), true);
  assert.equal(isPermissionTier("T5"), true);
  assert.equal(isPermissionTier("T9"), false);
  assert.equal(isPermissionTier("foo"), false);
});
