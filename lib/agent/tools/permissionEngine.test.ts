/**
 * Phase B B3 permission engine tests.
 *
 * `authorize(toolCall) -> ALLOW / CHALLENGE / DENY`. Deny-by-default tier
 * ladder T0–T5. Risk scoring elevates tier, never lowers. T2+ requires a
 * logged, unexpired approval. T5 is owner-only and never agent-granted.
 * Fail-closed on missing grant.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { authorize } from "./permissionEngine.ts";
import { createInMemoryPermissionStore } from "./permissionStore.ts";
import {
  PERMISSION_TIERS,
  type ApprovalRequest,
  type PermissionDecision,
  type ToolCall,
} from "./permissionTypes.ts";
import { scoreRisk } from "./riskScoring.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    workspaceId: "ws-1",
    actor: "user-1",
    toolName: "web.research.search",
    toolVersion: "1.0.0",
    toolFamily: "web.research.search",
    declaredTier: "T2",
    riskScore: null,
    argsHash: "0000000000000000000000000000000000000000000000000000000000000000",
    ...overrides,
  };
}

function makeStoreWithGrant(
  workspaceId: string,
  tier: string,
  toolFamily: string,
  expiresAt: string | null = null,
) {
  const store = createInMemoryPermissionStore({ now: () => FIXED_NOW });
  store.upsertGrant({
    workspaceId,
    tier: tier as any,
    toolFamily,
    grantedBy: null,
    scopeNotes: null,
    expiresAt,
  });
  return store;
}

async function authorizeWithStore(
  store: any,
  toolCall: ToolCall,
  workspacePaused = false,
  tenantKillSwitchEnabled = true,
) {
  let lastApproval: ApprovalRequest | null = null;
  return authorize(toolCall, {
    store,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused,
    tenantKillSwitchEnabled,
    findActiveApproval: async (
      _ws: string,
      _tier: string,
      _tf: string,
      _now: Date,
    ) => lastApproval,
    recordSecurityAlarm: async () => {},
    now: () => FIXED_NOW,
  } as any);
}

test("authorize returns DENY when flag is off", async () => {
  const store = createInMemoryPermissionStore({ now: () => FIXED_NOW });
  const result = await authorize(makeToolCall(), {
    store,
    gate: { enabled: false, reason: "flag_off" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    findActiveApproval: async () => null,
    recordSecurityAlarm: async () => {},
    now: () => FIXED_NOW,
  } as any);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "engine_flag_off");
  assert.equal(result.requiresApproval, true);
});

test("authorize returns DENY in production", async () => {
  const store = createInMemoryPermissionStore({ now: () => FIXED_NOW });
  const result = await authorize(makeToolCall(), {
    store,
    gate: { enabled: false, reason: "production" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    findActiveApproval: async () => null,
    recordSecurityAlarm: async () => {},
    now: () => FIXED_NOW,
  } as any);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "engine_production");
});

test("authorize returns DENY when workspace is paused", async () => {
  const store = makeStoreWithGrant("ws-1", "T2", "web.research.search");
  const result = await authorizeWithStore(store, makeToolCall(), true, true);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "workspace_paused");
});

test("authorize returns DENY when tenant kill switch is off", async () => {
  const store = makeStoreWithGrant("ws-1", "T2", "web.research.search");
  const result = await authorizeWithStore(store, makeToolCall(), false, false);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "tenant_kill_switch");
});

test("authorize returns DENY for T5 (owner-only, never agent-granted)", async () => {
  const store = makeStoreWithGrant("ws-1", "T5", "settings.secrets");
  const result = await authorizeWithStore(
    store,
    makeToolCall({ declaredTier: "T5", toolFamily: "settings.secrets" }),
    false,
    true,
  );
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "tier_t5_owner_only");
});

test("authorize returns DENY when no grant exists", async () => {
  const store = createInMemoryPermissionStore({ now: () => FIXED_NOW });
  const result = await authorizeWithStore(store, makeToolCall(), false, true);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "missing_grant");
  assert.equal(result.requiresApproval, true);
});

test("authorize returns DENY when grant is expired", async () => {
  // Create a store with a now before expiry, create grant with future expiry,
  // then authorize with a now after expiry.
  const store = createInMemoryPermissionStore({
    now: () => new Date("2026-11-09T17:00:00Z"),
  });
  await store.upsertGrant({
    workspaceId: "ws-1",
    tier: "T2",
    toolFamily: "web.research.search",
    grantedBy: null,
    scopeNotes: null,
    expiresAt: "2026-11-09T18:00:00Z",
  });
  const result = await authorize(makeToolCall(), {
    store,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    findActiveApproval: async () => null,
    recordSecurityAlarm: async () => {},
    now: () => new Date("2026-11-09T19:00:00Z"),
  } as any);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "expired_grant");
});

test("authorize returns ALLOW for T0 (auto, flag-gated)", async () => {
  const store = makeStoreWithGrant("ws-1", "T0", "workspace.file.read");
  const result = await authorizeWithStore(
    store,
    makeToolCall({ declaredTier: "T0", toolFamily: "workspace.file.read" }),
    false,
    true,
  );
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reason, "tier_t0_auto");
  assert.equal(result.requiresApproval, false);
});

test("authorize returns CHALLENGE for T1 without approval", async () => {
  const store = makeStoreWithGrant("ws-1", "T1", "workspace.file.write");
  const result = await authorizeWithStore(
    store,
    makeToolCall({ declaredTier: "T1", toolFamily: "workspace.file.write" }),
    false,
    true,
  );
  assert.equal(result.decision, "CHALLENGE");
  assert.equal(result.reason, "tier_T1_requires_approval");
  assert.equal(result.requiresApproval, true);
});

test("authorize returns ALLOW for T1 with active approval", async () => {
  const store = makeStoreWithGrant("ws-1", "T1", "workspace.file.write");
  const approval: ApprovalRequest = {
    id: "req-1",
    workspaceId: "ws-1",
    tier: "T1",
    toolFamily: "workspace.file.write",
    requestedBy: "user-1",
    scopeNotes: null,
    status: "approved",
    requestedAt: FIXED_NOW.toISOString(),
    expiresAt: null,
    decidedAt: FIXED_NOW.toISOString(),
    decidedBy: "admin-1",
    decisionEvidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  };
  let lastApproval: ApprovalRequest | null = approval;
  const result = await authorize(makeToolCall({ declaredTier: "T1", toolFamily: "workspace.file.write" }), {
    store,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    findActiveApproval: async () => lastApproval,
    recordSecurityAlarm: async () => {},
    now: () => FIXED_NOW,
  } as any);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reason, "tier_T1_approved");
  assert.equal(result.requiresApproval, false);
});

test("authorize returns CHALLENGE for T2 without approval", async () => {
  const store = makeStoreWithGrant("ws-1", "T2", "web.research.search");
  const result = await authorizeWithStore(store, makeToolCall(), false, true);
  assert.equal(result.decision, "CHALLENGE");
  assert.equal(result.reason, "tier_T2_requires_approval");
  assert.equal(result.requiresApproval, true);
});

test("authorize returns ALLOW for T2 with active approval", async () => {
  const store = makeStoreWithGrant("ws-1", "T2", "web.research.search");
  let lastApproval: ApprovalRequest | null = {
    id: "req-1",
    workspaceId: "ws-1",
    tier: "T2",
    toolFamily: "web.research.search",
    requestedBy: "user-1",
    scopeNotes: null,
    status: "approved",
    requestedAt: FIXED_NOW.toISOString(),
    expiresAt: null,
    decidedAt: FIXED_NOW.toISOString(),
    decidedBy: "admin-1",
    decisionEvidenceHash: "0000000000000000000000000000000000000000000000000000000000000000",
  };
  const result = await authorize(makeToolCall(), {
    store,
    gate: { enabled: true, reason: "enabled" },
    workspacePaused: false,
    tenantKillSwitchEnabled: true,
    findActiveApproval: async () => lastApproval,
    recordSecurityAlarm: async () => {},
    now: () => FIXED_NOW,
  } as any);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reason, "tier_T2_approved");
  assert.equal(result.requiresApproval, false);
});

test("authorize returns DENY for T2 with grant at declared tier but no grant at elevated tier", async () => {
  const store = makeStoreWithGrant("ws-1", "T1", "web.research.search");
  // Risk score elevates T2 to T4, but no grant at T4 → DENY with missing_grant
  const result = await authorize(
    makeToolCall({
      declaredTier: "T2",
      toolFamily: "web.research.search",
      riskScore: scoreRisk("T2", 3, 5, 1), // product 15 -> T4, max(T2, T4) = T4
    }),
    {
      store,
      gate: { enabled: true, reason: "enabled" },
      workspacePaused: false,
      tenantKillSwitchEnabled: true,
      findActiveApproval: async () => null,
      recordSecurityAlarm: async () => {},
      now: () => FIXED_NOW,
    } as any,
  );
  assert.equal(result.decision, "DENY");
  assert.equal(result.reason, "missing_grant");
  assert.equal(result.effectiveTier, "T4");
});

test("authorize returns ALLOW when risk elevates tier and grant exists at elevated tier", async () => {
  const store = makeStoreWithGrant("ws-1", "T4", "web.research.search");
  const result = await authorize(
    makeToolCall({
      declaredTier: "T2",
      toolFamily: "web.research.search",
      riskScore: scoreRisk("T2", 3, 5, 1), // product 15 -> T4, max(T2, T4) = T4
    }),
    {
      store,
      gate: { enabled: true, reason: "enabled" },
      workspacePaused: false,
      tenantKillSwitchEnabled: true,
      findActiveApproval: async () => null,
      recordSecurityAlarm: async () => {},
      now: () => FIXED_NOW,
    } as any,
  );
  assert.equal(result.decision, "CHALLENGE"); // T4 requires approval
  assert.equal(result.effectiveTier, "T4");
  assert.equal(result.reason, "tier_T4_requires_approval");
});

test("risk scoring never lowers tier: T4 declared with minimal risk stays T4", async () => {
  const store = makeStoreWithGrant("ws-1", "T4", "web.research.search");
  const result = await authorize(
    makeToolCall({
      declaredTier: "T4",
      toolFamily: "web.research.search",
      riskScore: scoreRisk("T4", 1, 1, 1), // product 1 -> risk base T0, max(T4, T0) = T4
    }),
    {
      store,
      gate: { enabled: true, reason: "enabled" },
      workspacePaused: false,
      tenantKillSwitchEnabled: true,
      findActiveApproval: async () => null,
      recordSecurityAlarm: async () => {},
      now: () => FIXED_NOW,
    } as any,
  );
  assert.equal(result.effectiveTier, "T4");
});

test("decisionHash is a sha256 hex string", async () => {
  const store = makeStoreWithGrant("ws-1", "T0", "workspace.file.read");
  const result = await authorizeWithStore(
    store,
    makeToolCall({ declaredTier: "T0", toolFamily: "workspace.file.read" }),
    false,
    true,
  );
  assert.match(result.decisionHash, /^[0-9a-f]{64}$/);
});

test("all permission tiers are covered", () => {
  assert.deepEqual(PERMISSION_TIERS, ["T0", "T1", "T2", "T3", "T4", "T5"]);
});
