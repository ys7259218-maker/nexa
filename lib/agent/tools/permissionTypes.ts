/**
 * Phase B B3 permission and safety engine contracts.
 *
 * These types are deliberately independent of any provider, network client,
 * or database driver. B3 adapters and stores are deterministic contracts;
 * the engine, gate, risk scorer, and credential broker are the durable
 * pieces. Nothing here calls a model provider, WhatsApp, OAuth, the
 * network, a browser, the filesystem, or any calendar API.
 */

export const PERMISSION_TIERS = ["T0", "T1", "T2", "T3", "T4", "T5"] as const;

export type PermissionTier = (typeof PERMISSION_TIERS)[number];

export const PERMISSION_DECISIONS = ["ALLOW", "CHALLENGE", "DENY"] as const;

export type PermissionDecision = (typeof PERMISSION_DECISIONS)[number];

export const ALARM_KINDS = [
  "self_grant_attempt",
  "approval_expiry_race",
  "fail_closed_denial",
  "missing_grant",
  "unknown_grant",
  "expired_grant",
] as const;

export type AlarmKind = (typeof ALARM_KINDS)[number];

export const ALARM_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number];

export type RiskDimension = "data_sensitivity" | "side_effect" | "blast_radius";

/**
 * Risk dimension score, 1 (minimal) to 5 (severe). A single elevated
 * dimension can elevate the effective tier; the effective tier never
 * drops below the manifest's declared tier.
 */
export type RiskScore = Readonly<{
  dataSensitivity: number;
  sideEffect: number;
  blastRadius: number;
  /**
   * Computed elevation: max(declaredTierIndex, riskTierIndex). Always
   * >= declared tier index, never lower.
   */
  effectiveTier: PermissionTier;
}>;

export type PermissionGrant = Readonly<{
  id: string;
  workspaceId: string;
  tier: PermissionTier;
  toolFamily: string;
  grantedBy: string | null;
  scopeNotes: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type ApprovalRequest = Readonly<{
  id: string;
  workspaceId: string;
  tier: PermissionTier;
  toolFamily: string;
  requestedBy: string | null;
  scopeNotes: string | null;
  status: "pending" | "approved" | "denied" | "expired";
  requestedAt: string;
  expiresAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionEvidenceHash: string | null;
}>;

export type ApprovalDecision = Readonly<{
  id: string;
  approvalRequestId: string;
  decision: "approved" | "denied" | "expired";
  decidedBy: string | null;
  decidedAt: string;
  evidenceHash: string;
}>;

export type SecurityAlarm = Readonly<{
  id: string;
  workspaceId: string;
  alarmKind: AlarmKind;
  severity: AlarmSeverity;
  detailHash: string;
  occurredAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}>;

export type ToolCall = Readonly<{
  workspaceId: string;
  actor: string | null;
  toolName: string;
  toolVersion: string;
  toolFamily: string;
  declaredTier: PermissionTier;
  riskScore: RiskScore | null;
  /**
   * Content-free hash of the tool arguments. Never raw content.
   */
  argsHash: string;
}>;

export type AuthorizeResult = Readonly<{
  decision: PermissionDecision;
  reason: string;
  /**
   * Content-free hash of the decision context, for audit logging.
   */
  decisionHash: string;
  effectiveTier: PermissionTier;
  requiresApproval: boolean;
  ttlSeconds: number | null;
}>;

export type PermissionEngineEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type PermissionEngineGateReason =
  | "enabled"
  | "flag_off"
  | "production";

export type PermissionEngineGate = {
  enabled: boolean;
  reason: PermissionEngineGateReason;
};

export function isPermissionTier(value: unknown): value is PermissionTier {
  return PERMISSION_TIERS.includes(value as PermissionTier);
}

export function isPermissionDecision(
  value: unknown,
): value is PermissionDecision {
  return PERMISSION_DECISIONS.includes(value as PermissionDecision);
}

export function isAlarmKind(value: unknown): value is AlarmKind {
  return ALARM_KINDS.includes(value as AlarmKind);
}

export function isAlarmSeverity(value: unknown): value is AlarmSeverity {
  return ALARM_SEVERITIES.includes(value as AlarmSeverity);
}

export const TIER_INDEX: Readonly<Record<PermissionTier, number>> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
};

export function tierIndex(tier: PermissionTier): number {
  return TIER_INDEX[tier];
}

/**
 * Risk dimension bounds. Each dimension is scored 1-5.
 */
export const RISK_DIMENSION_MIN = 1;
export const RISK_DIMENSION_MAX = 5;

export function isValidRiskDimension(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= RISK_DIMENSION_MIN &&
    value <= RISK_DIMENSION_MAX
  );
}

export const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

/**
 * Store outcome type, shared between in-memory and Supabase implementations.
 */
export type StoreOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export type UpsertGrantInput = Readonly<{
  workspaceId: string;
  tier: PermissionTier;
  toolFamily: string;
  grantedBy: string | null;
  scopeNotes: string | null;
  expiresAt: string | null;
}>;

export type CreateApprovalRequestInput = Readonly<{
  workspaceId: string;
  tier: PermissionTier;
  toolFamily: string;
  requestedBy: string | null;
  scopeNotes: string | null;
  expiresAt: string | null;
}>;

export type RecordApprovalDecisionInput = Readonly<{
  workspaceId: string;
  approvalRequestId: string;
  decision: "approved" | "denied" | "expired";
  decidedBy: string | null;
  evidenceHash: string;
}>;

export type SetCredentialMetadataInput = Readonly<{
  workspaceId: string;
  credentialKey: string;
  encryptedReference: string;
  lastRotatedAt: string | null;
}>;

export type CredentialMetadata = Readonly<{
  id: string;
  workspaceId: string;
  credentialKey: string;
  /**
   * Opaque encrypted reference into the server-only secret store. Never
   * plaintext.
   */
  encryptedReference: string;
  lastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type RecordSecurityAlarmInput = Readonly<{
  workspaceId: string;
  alarmKind: AlarmKind;
  severity: AlarmSeverity;
  detailHash: string;
}>;
