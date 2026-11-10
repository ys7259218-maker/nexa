/**
 * Phase B B3 permission and safety engine store contracts.
 *
 * Deterministic in-memory store with validation. A Supabase implementation
 * maps every write to the reviewed SECURITY DEFINER RPCs from migration
 * `20261109020000_permission_safety_engine_b3.sql`. Content-free hashes
 * only — never raw content or plaintext secrets.
 */

import { randomUUID } from "node:crypto";

import {
  HASH_PATTERN,
  type AlarmKind,
  type AlarmSeverity,
  type ApprovalDecision,
  type ApprovalRequest,
  type CredentialMetadata,
  type PermissionGrant,
  type PermissionTier,
  type RecordApprovalDecisionInput,
  type RecordSecurityAlarmInput,
  type SecurityAlarm,
  type SetCredentialMetadataInput,
  type StoreOutcome,
  type UpsertGrantInput,
  type CreateApprovalRequestInput,
  isAlarmKind,
  isAlarmSeverity,
  isPermissionTier,
  isSha256Hex,
} from "./permissionTypes.ts";

const TOOL_FAMILY_PATTERN =
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$/;
const NON_EMPTY_ID_PATTERN = /^[A-Za-z0-9:_-]{1,200}$/;

export type PermissionStore = Readonly<{
  // Grants
  upsertGrant(input: UpsertGrantInput): Promise<StoreOutcome<{ grantId: string }>>;
  revokeGrant(workspaceId: string, tier: PermissionTier, toolFamily: string): Promise<StoreOutcome<{ revokedId: string | null }>>;
  listGrants(workspaceId: string): Promise<PermissionGrant[]>;
  getGrant(workspaceId: string, tier: PermissionTier, toolFamily: string): Promise<PermissionGrant | null>;

  // Approval requests
  createApprovalRequest(input: CreateApprovalRequestInput): Promise<StoreOutcome<{ requestId: string }>>;
  listApprovalRequests(workspaceId: string, status?: "pending" | "approved" | "denied" | "expired"): Promise<ApprovalRequest[]>;
  getApprovalRequest(requestId: string): Promise<ApprovalRequest | null>;

  // Approval decisions
  recordApprovalDecision(input: RecordApprovalDecisionInput): Promise<StoreOutcome<{ decisionId: string }>>;
  listApprovalDecisions(workspaceId: string): Promise<ApprovalDecision[]>;

  // Credential broker metadata
  setCredentialMetadata(input: SetCredentialMetadataInput): Promise<StoreOutcome<{ metadataId: string }>>;
  getCredentialMetadata(workspaceId: string, credentialKey: string): Promise<CredentialMetadata | null>;
  listCredentialMetadata(workspaceId: string): Promise<CredentialMetadata[]>;

  // Security alarms
  recordSecurityAlarm(input: RecordSecurityAlarmInput): Promise<StoreOutcome<{ alarmId: string }>>;
  listSecurityAlarms(workspaceId: string): Promise<SecurityAlarm[]>;
}>;

function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && NON_EMPTY_ID_PATTERN.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function validateGrantInput(input: UpsertGrantInput, now: () => Date): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isPermissionTier(input.tier)) return "invalid_tier";
  if (!TOOL_FAMILY_PATTERN.test(input.toolFamily)) return "invalid_tool_family";
  if (
    input.grantedBy !== null &&
    (!isNonEmptyId(input.grantedBy) || input.grantedBy.length !== 36)
  ) {
    return "invalid_granted_by";
  }
  if (input.scopeNotes !== null && typeof input.scopeNotes !== "string") {
    return "invalid_scope_notes";
  }
  if (
    input.expiresAt !== null &&
    (!isIsoTimestamp(input.expiresAt) || new Date(input.expiresAt) <= now())
  ) {
    return "expired_grant_not_allowed";
  }
  return null;
}

function validateApprovalRequestInput(
  input: CreateApprovalRequestInput,
  now: () => Date,
): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isPermissionTier(input.tier)) return "invalid_tier";
  if (!TOOL_FAMILY_PATTERN.test(input.toolFamily)) return "invalid_tool_family";
  if (
    input.requestedBy !== null &&
    (!isNonEmptyId(input.requestedBy) || input.requestedBy.length !== 36)
  ) {
    return "invalid_requested_by";
  }
  if (input.scopeNotes !== null && typeof input.scopeNotes !== "string") {
    return "invalid_scope_notes";
  }
  if (
    input.expiresAt !== null &&
    (!isIsoTimestamp(input.expiresAt) ||
      new Date(input.expiresAt) <= now())
  ) {
    return "expired_approval_not_allowed";
  }
  return null;
}

function validateDecisionInput(input: RecordApprovalDecisionInput): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isNonEmptyId(input.approvalRequestId)) return "invalid_approval_request";
  if (
    input.decision !== "approved" &&
    input.decision !== "denied" &&
    input.decision !== "expired"
  ) {
    return "invalid_decision";
  }
  if (
    input.decidedBy !== null &&
    (!isNonEmptyId(input.decidedBy) || input.decidedBy.length !== 36)
  ) {
    return "invalid_decided_by";
  }
  if (!isSha256Hex(input.evidenceHash)) return "invalid_evidence_hash";
  return null;
}

function validateCredentialMetadataInput(input: SetCredentialMetadataInput): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!TOOL_FAMILY_PATTERN.test(input.credentialKey)) return "invalid_credential_key";
  if (!isNonEmptyId(input.encryptedReference)) return "invalid_encrypted_reference";
  if (
    input.lastRotatedAt !== null && !isIsoTimestamp(input.lastRotatedAt)
  ) {
    return "invalid_last_rotated_at";
  }
  return null;
}

function validateAlarmInput(input: RecordSecurityAlarmInput): string | null {
  if (!isNonEmptyId(input.workspaceId)) return "invalid_workspace";
  if (!isAlarmKind(input.alarmKind)) return "invalid_alarm_kind";
  if (!isAlarmSeverity(input.severity)) return "invalid_severity";
  if (!isSha256Hex(input.detailHash)) return "invalid_detail_hash";
  return null;
}

function cloneGrant(row: PermissionGrant): PermissionGrant {
  return { ...row };
}

function cloneApprovalRequest(row: ApprovalRequest): ApprovalRequest {
  return { ...row };
}

function cloneApprovalDecision(row: ApprovalDecision): ApprovalDecision {
  return { ...row };
}

function cloneCredentialMetadata(row: CredentialMetadata): CredentialMetadata {
  return { ...row };
}

function cloneSecurityAlarm(row: SecurityAlarm): SecurityAlarm {
  return { ...row };
}

export function createInMemoryPermissionStore(
  options: {
    now?: () => Date;
    idFactory?: () => string;
  } = {},
): PermissionStore {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => randomUUID());

  const grants = new Map<string, PermissionGrant>();
  const grantsByWorkspaceTierFamily = new Map<string, string>(); // workspaceId:tier:toolFamily -> grantId
  const approvalRequests = new Map<string, ApprovalRequest>();
  const approvalDecisions = new Map<string, ApprovalDecision>();
  const decisionsByRequest = new Map<string, string>(); // approvalRequestId -> decisionId
  const credentialMetadata = new Map<string, CredentialMetadata>();
  const credentialsByWorkspaceKey = new Map<string, string>(); // workspaceId:credentialKey -> metadataId
  const securityAlarms = new Map<string, SecurityAlarm>();

  return {
    async upsertGrant(input) {
      const invalid = validateGrantInput(input, now);
      if (invalid) return { ok: false, reason: invalid };

      const key = `${input.workspaceId}:${input.tier}:${input.toolFamily}`;
      const existing = grants.get(grantsByWorkspaceTierFamily.get(key) ?? "");

      const grant: PermissionGrant = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        tier: input.tier,
        toolFamily: input.toolFamily,
        grantedBy: input.grantedBy,
        scopeNotes: input.scopeNotes,
        expiresAt: input.expiresAt,
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
      };

      grants.set(grant.id, grant);
      grantsByWorkspaceTierFamily.set(key, grant.id);
      return { ok: true, value: { grantId: grant.id } };
    },

    async revokeGrant(workspaceId, tier, toolFamily) {
      const key = `${workspaceId}:${tier}:${toolFamily}`;
      const grantId = grantsByWorkspaceTierFamily.get(key);
      if (!grantId) return { ok: false, reason: "grant_not_found" };

      const grant = grants.get(grantId);
      if (!grant || grant.workspaceId !== workspaceId) {
        return { ok: false, reason: "grant_not_found" };
      }

      grants.delete(grantId);
      grantsByWorkspaceTierFamily.delete(key);
      return { ok: true, value: { revokedId: grantId } };
    },

    async listGrants(workspaceId) {
      return [...grants.values()]
        .filter((g) => g.workspaceId === workspaceId)
        .map(cloneGrant);
    },

    async getGrant(workspaceId, tier, toolFamily) {
      const key = `${workspaceId}:${tier}:${toolFamily}`;
      const grantId = grantsByWorkspaceTierFamily.get(key);
      if (!grantId) return null;
      const grant = grants.get(grantId);
      return grant?.workspaceId === workspaceId ? cloneGrant(grant) : null;
    },

    async createApprovalRequest(input) {
      const invalid = validateApprovalRequestInput(input, now);
      if (invalid) return { ok: false, reason: invalid };

      const request: ApprovalRequest = {
        id: idFactory(),
        workspaceId: input.workspaceId,
        tier: input.tier,
        toolFamily: input.toolFamily,
        requestedBy: input.requestedBy,
        scopeNotes: input.scopeNotes,
        status: "pending",
        requestedAt: now().toISOString(),
        expiresAt: input.expiresAt,
        decidedAt: null,
        decidedBy: null,
        decisionEvidenceHash: null,
      };

      approvalRequests.set(request.id, request);
      return { ok: true, value: { requestId: request.id } };
    },

    async listApprovalRequests(workspaceId, status) {
      return [...approvalRequests.values()]
        .filter((r) => r.workspaceId === workspaceId)
        .filter((r) => status === undefined || r.status === status)
        .map(cloneApprovalRequest);
    },

    async getApprovalRequest(requestId) {
      const request = approvalRequests.get(requestId);
      return request ? cloneApprovalRequest(request) : null;
    },

    async recordApprovalDecision(input) {
      const invalid = validateDecisionInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const request = approvalRequests.get(input.approvalRequestId);
      if (!request) return { ok: false, reason: "approval_request_not_found" };
      if (request.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "workspace_mismatch" };
      }
      if (request.status !== "pending") {
        return { ok: false, reason: "already_decided" };
      }

      const decision: ApprovalDecision = {
        id: idFactory(),
        approvalRequestId: input.approvalRequestId,
        decision: input.decision,
        decidedBy: input.decidedBy,
        decidedAt: now().toISOString(),
        evidenceHash: input.evidenceHash,
      };

      approvalDecisions.set(decision.id, decision);
      decisionsByRequest.set(input.approvalRequestId, decision.id);

      const updated: ApprovalRequest = {
        ...request,
        status: input.decision,
        decidedAt: now().toISOString(),
        decidedBy: input.decidedBy,
        decisionEvidenceHash: input.evidenceHash,
      };
      approvalRequests.set(input.approvalRequestId, updated);

      return { ok: true, value: { decisionId: decision.id } };
    },

    async listApprovalDecisions(workspaceId) {
      return [...approvalDecisions.values()]
        .filter((d) => {
          const request = approvalRequests.get(d.approvalRequestId);
          return request?.workspaceId === workspaceId;
        })
        .map(cloneApprovalDecision);
    },

    async setCredentialMetadata(input) {
      const invalid = validateCredentialMetadataInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const key = `${input.workspaceId}:${input.credentialKey}`;
      const existing = credentialMetadata.get(
        credentialsByWorkspaceKey.get(key) ?? "",
      );

      const metadata: CredentialMetadata = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        credentialKey: input.credentialKey,
        encryptedReference: input.encryptedReference,
        lastRotatedAt: input.lastRotatedAt,
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
      };

      credentialMetadata.set(metadata.id, metadata);
      credentialsByWorkspaceKey.set(key, metadata.id);
      return { ok: true, value: { metadataId: metadata.id } };
    },

    async getCredentialMetadata(workspaceId, credentialKey) {
      const key = `${workspaceId}:${credentialKey}`;
      const metadataId = credentialsByWorkspaceKey.get(key);
      if (!metadataId) return null;
      const metadata = credentialMetadata.get(metadataId);
      return metadata?.workspaceId === workspaceId
        ? cloneCredentialMetadata(metadata)
        : null;
    },

    async listCredentialMetadata(workspaceId) {
      return [...credentialMetadata.values()]
        .filter((m) => m.workspaceId === workspaceId)
        .map(cloneCredentialMetadata);
    },

    async recordSecurityAlarm(input) {
      const invalid = validateAlarmInput(input);
      if (invalid) return { ok: false, reason: invalid };

      const alarm: SecurityAlarm = {
        id: idFactory(),
        workspaceId: input.workspaceId,
        alarmKind: input.alarmKind,
        severity: input.severity,
        detailHash: input.detailHash,
        occurredAt: now().toISOString(),
        resolvedAt: null,
        resolvedBy: null,
      };

      securityAlarms.set(alarm.id, alarm);
      return { ok: true, value: { alarmId: alarm.id } };
    },

    async listSecurityAlarms(workspaceId) {
      return [...securityAlarms.values()]
        .filter((a) => a.workspaceId === workspaceId)
        .map(cloneSecurityAlarm);
    },
  };
}
