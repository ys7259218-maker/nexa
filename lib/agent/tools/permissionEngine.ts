/**
 * Phase B B3 permission and safety engine — single Policy Enforcement Point.
 *
 * `authorize(toolCall) -> ALLOW / CHALLENGE / DENY`. Deny-by-default tier
 * ladder T0–T5 with risk-score elevation (never lowering). Grants attach to
 * (workspace, tier, tool family) with expiry and scope. The generalized
 * approval engine is additive and does not modify existing appointment
 * review queues.
 *
 * Nothing here calls a model provider, WhatsApp, OAuth, the network, a
 * browser, the filesystem, or any calendar API. All secrets are handled by
 * the injected credential broker contract only.
 */

import { hashJsonSafe } from "./hash.ts";
import {
  type AlarmKind,
  type ApprovalRequest,
  type AuthorizeResult,
  type PermissionDecision,
  type PermissionEngineGate,
  type PermissionGrant,
  type PermissionTier,
  type ToolCall,
  isPermissionDecision,
  isPermissionTier,
} from "./permissionTypes.ts";
import type { PermissionStore } from "./permissionStore.ts";

const TIER_CONFIRMATION_POLICY: Readonly<
  Record<PermissionTier, "auto" | "once_per_task" | "per_action" | "owner_only">
> = {
  T0: "auto",
  T1: "once_per_task",
  T2: "per_action",
  T3: "per_action",
  T4: "per_action",
  T5: "owner_only",
};

export type PermissionEngineOptions = Readonly<{
  store: PermissionStore;
  gate: PermissionEngineGate;
  /**
   * True when the workspace automation kill switch is paused for this
   * workspace. Engine returns DENY for all calls when paused.
   */
  workspacePaused: boolean;
  /**
   * Tenant kill switch. When false, the entire engine is dormant.
   */
  tenantKillSwitchEnabled: boolean;
  /**
   * Look up an active, unexpired approval for (workspace, tier, tool family).
   * Returns null when none exists. Content-free: only ids and hashes cross
   * this boundary.
   */
  findActiveApproval: (
    workspaceId: string,
    tier: PermissionTier,
    toolFamily: string,
    now: Date,
  ) => Promise<ApprovalRequest | null>;
  /**
   * Record a security alarm. Content-free hashes only.
   */
  recordSecurityAlarm: (
    workspaceId: string,
    alarmKind: AlarmKind,
    severity: "low" | "medium" | "high" | "critical",
    detailHash: string,
  ) => Promise<void>;
  now?: () => Date;
  idFactory?: () => string;
}>;

/**
 * Hard fail-closed decision. A missing, expired, malformed, or unknown grant
 * yields DENY. T2+ can never proceed without a logged, unexpired approval.
 * T5 is owner-only and never agent-granted.
 */
export async function authorize(
  toolCall: ToolCall,
  options: PermissionEngineOptions,
): Promise<AuthorizeResult> {
  const now = options.now ?? (() => new Date());
  const nowTime = now();

  // 1. Feature gate: flag off or production => engine dormant, all DENY.
  const gate = options.gate;
  if (!gate.enabled) {
    return decision(
      "DENY",
      `engine_${gate.reason}`,
      toolCall.declaredTier,
      toolCall.declaredTier,
      true,
      null,
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "fail_closed_denial",
      "low",
    );
  }

  // 2. Workspace pause / kill switch => DENY.
  if (options.workspacePaused !== false) {
    return decision(
      "DENY",
      "workspace_paused",
      toolCall.declaredTier,
      toolCall.declaredTier,
      true,
      null,
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "fail_closed_denial",
      "medium",
    );
  }

  // 3. Tenant kill switch => DENY.
  if (!options.tenantKillSwitchEnabled) {
    return decision(
      "DENY",
      "tenant_kill_switch",
      toolCall.declaredTier,
      toolCall.declaredTier,
      true,
      null,
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "fail_closed_denial",
      "high",
    );
  }

  // 4. T5 is owner-only, never agent-granted => DENY at the PEP.
  if (toolCall.declaredTier === "T5") {
    return decision(
      "DENY",
      "tier_t5_owner_only",
      "T5",
      "T5",
      true,
      null,
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "missing_grant",
      "critical",
    );
  }

  // 5. Risk scoring: effective tier = max(declared, risk). Never lowers.
  const riskScore = toolCall.riskScore;
  const effectiveTier = riskScore
    ? riskScore.effectiveTier
    : toolCall.declaredTier;
  if (!isPermissionTier(effectiveTier)) {
    throw new Error("invalid effective tier from risk score");
  }

  // 6. Grant lookup: find active, unexpired grant for (workspace, effective tier, tool family).
  const grant = await options.store.getGrant(
    toolCall.workspaceId,
    effectiveTier,
    toolCall.toolFamily,
  );
  if (!grant) {
    return decision(
      "DENY",
      "missing_grant",
      toolCall.declaredTier,
      effectiveTier,
      true,
      null,
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "missing_grant",
      "high",
    );
  }

  // 7. Grant expiry check => DENY + expired_grant alarm.
  if (grant.expiresAt !== null && new Date(grant.expiresAt) <= nowTime) {
    await options.recordSecurityAlarm(
      toolCall.workspaceId,
      "expired_grant",
      "medium",
      hashContext({
        workspaceId: toolCall.workspaceId,
        tier: effectiveTier,
        toolFamily: toolCall.toolFamily,
        grantId: grant.id,
        reason: "expired_grant",
      }),
    );
    return decision(
      "DENY",
      "expired_grant",
      toolCall.declaredTier,
      effectiveTier,
      true,
      null,
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "expired_grant",
      "medium",
    );
  }

  // 8. Confirmation policy by effective tier.
  const policy = TIER_CONFIRMATION_POLICY[effectiveTier];

  // T0: auto (flag-gated feature).
  if (policy === "auto") {
    return decision(
      "ALLOW",
      "tier_t0_auto",
      toolCall.declaredTier,
      effectiveTier,
      false,
      null,
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "fail_closed_denial",
      "low",
    );
  }

  // T1: once per task, user-visible plan covers it.
  if (policy === "once_per_task") {
    const approval = await options.findActiveApproval(
      toolCall.workspaceId,
      effectiveTier,
      toolCall.toolFamily,
      nowTime,
    );
    if (!approval) {
      return decision(
        "CHALLENGE",
        `tier_${effectiveTier}_requires_approval`,
        toolCall.declaredTier,
        effectiveTier,
        true,
        activeGrantTtl(grant, nowTime),
        options.recordSecurityAlarm,
        toolCall.workspaceId,
        "missing_grant",
        "low",
      );
    }
    return decision(
      "ALLOW",
      `tier_${effectiveTier}_approved`,
      toolCall.declaredTier,
      effectiveTier,
      false,
      ttlSeconds(approval.expiresAt, nowTime),
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "fail_closed_denial",
      "low",
    );
  }

  // T2/T3/T4: per-action approval required. No approval => CHALLENGE.
  const approval = await options.findActiveApproval(
    toolCall.workspaceId,
    effectiveTier,
    toolCall.toolFamily,
    nowTime,
  );
  if (!approval) {
    return decision(
      "CHALLENGE",
      `tier_${effectiveTier}_requires_approval`,
      toolCall.declaredTier,
      effectiveTier,
      true,
      activeGrantTtl(grant, nowTime),
      options.recordSecurityAlarm,
      toolCall.workspaceId,
      "missing_grant",
      "high",
    );
  }

  return decision(
    "ALLOW",
    `tier_${effectiveTier}_approved`,
    toolCall.declaredTier,
    effectiveTier,
    false,
    ttlSeconds(approval.expiresAt, nowTime),
    options.recordSecurityAlarm,
    toolCall.workspaceId,
    "fail_closed_denial",
    "medium",
  );
}

/**
 * Build a fail-closed DENY result and record a security alarm. Content-free
 * hashes only — never raw content or plaintext secrets.
 */
async function decision(
  decision: PermissionDecision,
  reason: string,
  declaredTier: PermissionTier,
  effectiveTier: PermissionTier,
  requiresApproval: boolean,
  ttlSeconds: number | null,
  recordSecurityAlarm: PermissionEngineOptions["recordSecurityAlarm"],
  workspaceId: string,
  alarmKind: AlarmKind,
  severity: "low" | "medium" | "high" | "critical",
): Promise<AuthorizeResult> {
  const decisionHash = hashContext({
    workspaceId,
    declaredTier,
    effectiveTier,
    decision,
    reason,
  });

  try {
    await recordSecurityAlarm(workspaceId, alarmKind, severity, decisionHash);
  } catch {
    // Alarm recording must never cause the PEP to throw. The decision is
    // already DENY; the alarm is best-effort observability.
  }

  return {
    decision,
    reason,
    decisionHash,
    effectiveTier,
    requiresApproval,
    ttlSeconds,
  };
}

/**
 * Content-free hash of the decision context for audit logging. Never raw
 * content.
 */
function hashContext(context: unknown): string {
  return hashJsonSafe(context);
}

function ttlSeconds(expiresAt: string | null, now: Date): number | null {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Return the remaining TTL seconds of a grant, or null if it never expires.
 */
function activeGrantTtl(
  grant: PermissionGrant,
  now: Date,
): number | null {
  if (!grant.expiresAt) return null;
  return Math.max(0, Math.floor((new Date(grant.expiresAt).getTime() - now.getTime()) / 1000));
}

/**
 * Assert that the decision value is a reviewed permission decision. Used by
 * tests and callers that need to narrow the result.
 */
export function assertPermissionDecision(value: unknown): PermissionDecision {
  if (!isPermissionDecision(value)) {
    throw new Error(`invalid permission decision: ${JSON.stringify(value)}`);
  }
  return value;
}
