/**
 * Phase B B3 Supabase store for permission and safety engine tables.
 *
 * Server-only adapter. Every write maps to a reviewed SECURITY DEFINER RPC
 * from migration `20261109020000_permission_safety_engine_b3.sql` or to a
 * service-role insert for approval request creation. Read paths use
 * RLS-scoped selects. Content-free hashes only — never raw content or
 * plaintext secrets.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ApprovalDecision,
  ApprovalRequest,
  CredentialMetadata,
  PermissionGrant,
  SecurityAlarm,
  StoreOutcome,
} from "./permissionTypes.ts";
import {
  isAlarmKind,
  isAlarmSeverity,
  isPermissionTier,
  isSha256Hex,
} from "./permissionTypes.ts";

type RpcRow = Record<string, unknown>;

export type SupabasePermissionStore = Readonly<{
  upsertGrant(input: {
    workspaceId: string;
    tier: string;
    toolFamily: string;
    grantedBy: string | null;
    scopeNotes: string | null;
    expiresAt: string | null;
  }): Promise<StoreOutcome<{ grantId: string }>>;
  revokeGrant(input: {
    workspaceId: string;
    tier: string;
    toolFamily: string;
  }): Promise<StoreOutcome<{ revokedId: string | null }>>;
  listGrants(workspaceId: string): Promise<PermissionGrant[]>;
  getGrant(
    workspaceId: string,
    tier: string,
    toolFamily: string,
  ): Promise<PermissionGrant | null>;

  createApprovalRequest(input: {
    workspaceId: string;
    tier: string;
    toolFamily: string;
    requestedBy: string | null;
    scopeNotes: string | null;
    expiresAt: string | null;
  }): Promise<StoreOutcome<{ requestId: string }>>;
  listApprovalRequests(
    workspaceId: string,
    status?: "pending" | "approved" | "denied" | "expired",
  ): Promise<ApprovalRequest[]>;
  getApprovalRequest(requestId: string): Promise<ApprovalRequest | null>;

  recordApprovalDecision(input: {
    workspaceId: string;
    approvalRequestId: string;
    decision: "approved" | "denied" | "expired";
    decidedBy: string | null;
    evidenceHash: string;
  }): Promise<StoreOutcome<{ decisionId: string }>>;
  listApprovalDecisions(workspaceId: string): Promise<ApprovalDecision[]>;

  setCredentialMetadata(input: {
    workspaceId: string;
    credentialKey: string;
    encryptedReference: string;
    lastRotatedAt: string | null;
  }): Promise<StoreOutcome<{ metadataId: string }>>;
  getCredentialMetadata(
    workspaceId: string,
    credentialKey: string,
  ): Promise<CredentialMetadata | null>;
  listCredentialMetadata(workspaceId: string): Promise<CredentialMetadata[]>;

  recordSecurityAlarm(input: {
    workspaceId: string;
    alarmKind: string;
    severity: string;
    detailHash: string;
  }): Promise<StoreOutcome<{ alarmId: string }>>;
  listSecurityAlarms(workspaceId: string): Promise<SecurityAlarm[]>;
}>;

function firstRow(data: unknown): RpcRow | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  return typeof data[0] === "object" && data[0] !== null
    ? (data[0] as RpcRow)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function mapPermissionGrantRow(row: unknown): PermissionGrant | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const tier = r.tier;
  const toolFamily = asText(r.tool_family);
  const grantedBy = r.granted_by === null ? null : asText(r.granted_by);
  const scopeNotes = r.scope_notes === null ? null : asText(r.scope_notes);
  const expiresAt = r.expires_at === null ? null : asIso(r.expires_at);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);

  if (
    !id ||
    !workspaceId ||
    !isPermissionTier(tier) ||
    !toolFamily ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    tier: tier as PermissionGrant["tier"],
    toolFamily,
    grantedBy,
    scopeNotes,
    expiresAt,
    createdAt,
    updatedAt,
  };
}

function mapApprovalRequestRow(row: unknown): ApprovalRequest | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const tier = r.tier;
  const toolFamily = asText(r.tool_family);
  const requestedBy = r.requested_by === null ? null : asText(r.requested_by);
  const scopeNotes = r.scope_notes === null ? null : asText(r.scope_notes);
  const status = r.status;
  const requestedAt = asIso(r.requested_at);
  const expiresAt = r.expires_at === null ? null : asIso(r.expires_at);
  const decidedAt = r.decided_at === null ? null : asIso(r.decided_at);
  const decidedBy = r.decided_by === null ? null : asText(r.decided_by);
  const decisionEvidenceHash =
    r.decision_evidence_hash === null
      ? null
      : asText(r.decision_evidence_hash);

  if (
    !id ||
    !workspaceId ||
    !isPermissionTier(tier) ||
    !toolFamily ||
    (status !== "pending" &&
      status !== "approved" &&
      status !== "denied" &&
      status !== "expired") ||
    !requestedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    tier: tier as ApprovalRequest["tier"],
    toolFamily,
    requestedBy,
    scopeNotes,
    status: status as ApprovalRequest["status"],
    requestedAt,
    expiresAt,
    decidedAt,
    decidedBy,
    decisionEvidenceHash,
  };
}

function mapApprovalDecisionRow(row: unknown): ApprovalDecision | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const approvalRequestId = asText(r.approval_request_id);
  const decision = r.decision;
  const decidedBy = r.decided_by === null ? null : asText(r.decided_by);
  const decidedAt = asIso(r.decided_at);
  const evidenceHash = asText(r.evidence_hash);

  if (
    !id ||
    !approvalRequestId ||
    (decision !== "approved" && decision !== "denied" && decision !== "expired") ||
    !decidedAt ||
    !evidenceHash ||
    !isSha256Hex(evidenceHash)
  ) {
    return null;
  }

  return {
    id,
    approvalRequestId,
    decision: decision as ApprovalDecision["decision"],
    decidedBy,
    decidedAt,
    evidenceHash,
  };
}

function mapCredentialMetadataRow(row: unknown): CredentialMetadata | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const credentialKey = asText(r.credential_key);
  const encryptedReference = asText(r.encrypted_reference);
  const lastRotatedAt =
    r.last_rotated_at === null ? null : asIso(r.last_rotated_at);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);

  if (
    !id ||
    !workspaceId ||
    !credentialKey ||
    !encryptedReference ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    credentialKey,
    encryptedReference,
    lastRotatedAt,
    createdAt,
    updatedAt,
  };
}

function mapSecurityAlarmRow(row: unknown): SecurityAlarm | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const alarmKind = r.alarm_kind;
  const severity = r.severity;
  const detailHash = asText(r.detail_hash);
  const occurredAt = asIso(r.occurred_at);
  const resolvedAt = r.resolved_at === null ? null : asIso(r.resolved_at);
  const resolvedBy = r.resolved_by === null ? null : asText(r.resolved_by);

  if (
    !id ||
    !workspaceId ||
    !isAlarmKind(alarmKind) ||
    !isAlarmSeverity(severity) ||
    !detailHash ||
    !isSha256Hex(detailHash) ||
    !occurredAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    alarmKind: alarmKind as SecurityAlarm["alarmKind"],
    severity: severity as SecurityAlarm["severity"],
    detailHash,
    occurredAt,
    resolvedAt,
    resolvedBy,
  };
}

export function createSupabasePermissionStore(
  service: SupabaseClient,
): SupabasePermissionStore {
  return {
    async upsertGrant(input) {
      const result = await service.rpc("upsert_permission_grant", {
        p_workspace_id: input.workspaceId,
        p_tier: input.tier,
        p_tool_family: input.toolFamily,
        p_granted_by: input.grantedBy,
        p_scope_notes: input.scopeNotes,
        p_expires_at: input.expiresAt,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.grant_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, value: { grantId: id } };
    },

    async revokeGrant(input) {
      const result = await service.rpc("revoke_permission_grant", {
        p_workspace_id: input.workspaceId,
        p_tier: input.tier,
        p_tool_family: input.toolFamily,
      });
      if (result.error) return { ok: false, reason: "revoke_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.revoked_id) : null;
      if (reason !== "revoked" || !id) {
        return { ok: false, reason: reason ?? "revoke_rejected" };
      }
      return { ok: true, value: { revokedId: id } };
    },

    async listGrants(workspaceId) {
      const result = await service
        .from("permission_grants")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("tier", { ascending: true })
        .order("tool_family", { ascending: true });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapPermissionGrantRow(row))
        .filter((row): row is PermissionGrant => row !== null);
    },

    async getGrant(workspaceId, tier, toolFamily) {
      const result = await service
        .from("permission_grants")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("tier", tier)
        .eq("tool_family", toolFamily)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return mapPermissionGrantRow(result.data);
    },

    async createApprovalRequest(input) {
      const result = await service.from("agent_approval_requests").insert({
        workspace_id: input.workspaceId,
        tier: input.tier,
        tool_family: input.toolFamily,
        requested_by: input.requestedBy,
        scope_notes: input.scopeNotes,
        status: "pending",
        expires_at: input.expiresAt,
      });
      if (result.error) return { ok: false, reason: "insert_error" };
      const row = firstRow(result.data);
      const id = row ? asText(row.id) : null;
      if (!id) return { ok: false, reason: "insert_rejected" };
      return { ok: true, value: { requestId: id } };
    },

    async listApprovalRequests(workspaceId, status) {
      let query = service
        .from("agent_approval_requests")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("requested_at", { ascending: false });
      if (status) {
        query = query.eq("status", status);
      }
      const result = await query;
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapApprovalRequestRow(row))
        .filter((row): row is ApprovalRequest => row !== null);
    },

    async getApprovalRequest(requestId) {
      const result = await service
        .from("agent_approval_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return mapApprovalRequestRow(result.data);
    },

    async recordApprovalDecision(input) {
      const result = await service.rpc("record_approval_decision", {
        p_workspace_id: input.workspaceId,
        p_approval_request_id: input.approvalRequestId,
        p_decision: input.decision,
        p_decided_by: input.decidedBy,
        p_evidence_hash: input.evidenceHash,
      });
      if (result.error) return { ok: false, reason: "record_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.decision_id) : null;
      if (reason !== "recorded" || !id) {
        return { ok: false, reason: reason ?? "record_rejected" };
      }
      return { ok: true, value: { decisionId: id } };
    },

    async listApprovalDecisions(workspaceId) {
      const result = await service
        .from("agent_approval_decisions")
        .select("*, approval_request_id")
        .order("decided_at", { ascending: false });
      if (result.error || !Array.isArray(result.data)) return [];
      const decisions: ApprovalDecision[] = [];
      for (const row of result.data) {
        const mapped = mapApprovalDecisionRow(row);
        if (!mapped) continue;
        const request = await service
          .from("agent_approval_requests")
          .select("workspace_id")
          .eq("id", mapped.approvalRequestId)
          .maybeSingle();
        if (
          !request.error &&
          request.data &&
          (request.data as Record<string, unknown>).workspace_id === workspaceId
        ) {
          decisions.push(mapped);
        }
      }
      return decisions;
    },

    async setCredentialMetadata(input) {
      const result = await service.from("credential_broker_metadata").upsert(
        {
          workspace_id: input.workspaceId,
          credential_key: input.credentialKey,
          encrypted_reference: input.encryptedReference,
          last_rotated_at: input.lastRotatedAt,
          updated_at: new Date().toISOString(),
        },
      );
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const id = row ? asText(row.id) : null;
      if (!id) return { ok: false, reason: "upsert_rejected" };
      return { ok: true, value: { metadataId: id } };
    },

    async getCredentialMetadata(workspaceId, credentialKey) {
      const result = await service
        .from("credential_broker_metadata")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("credential_key", credentialKey)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return mapCredentialMetadataRow(result.data);
    },

    async listCredentialMetadata(workspaceId) {
      const result = await service
        .from("credential_broker_metadata")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("credential_key", { ascending: true });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapCredentialMetadataRow(row))
        .filter((row): row is CredentialMetadata => row !== null);
    },

    async recordSecurityAlarm(input) {
      const result = await service.rpc("record_security_alarm", {
        p_workspace_id: input.workspaceId,
        p_alarm_kind: input.alarmKind,
        p_severity: input.severity,
        p_detail_hash: input.detailHash,
      });
      if (result.error) return { ok: false, reason: "record_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.alarm_id) : null;
      if (reason !== "recorded" || !id) {
        return { ok: false, reason: reason ?? "record_rejected" };
      }
      return { ok: true, value: { alarmId: id } };
    },

    async listSecurityAlarms(workspaceId) {
      const result = await service
        .from("security_alarms")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("occurred_at", { ascending: false });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapSecurityAlarmRow(row))
        .filter((row): row is SecurityAlarm => row !== null);
    },
  };
}
