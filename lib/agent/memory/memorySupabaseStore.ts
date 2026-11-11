/**
 * Phase B B5 Supabase store for memory system tables.
 *
 * Server-only adapter. Every write maps to a reviewed SECURITY DEFINER RPC
 * from migration `20261109040000_memory_system_b5.sql`. Read paths use
 * RLS-scoped selects. Content-free hashes only — never raw content or
 * plaintext secrets.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MemoryConsentRecord,
  MemoryExternalDataRef,
  MemorySessionScratchpad,
  MemoryStore,
  MemoryTaskMemory,
  MemoryUserApprovedFact,
  StoreOutcome,
} from "./memoryTypes.ts";

type RpcRow = Record<string, unknown>;

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

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapScratchpadRow(row: unknown): MemorySessionScratchpad | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const taskId = asText(r.task_id);
  const scratchpadKey = asText(r.scratchpad_key);
  const scratchpadValue = r.scratchpad_value;
  const ttlSeconds = asInteger(r.ttl_seconds);
  const expiresAt = asIso(r.expires_at);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);

  if (
    !id ||
    !workspaceId ||
    !taskId ||
    !scratchpadKey ||
    !scratchpadValue ||
    typeof scratchpadValue !== "object" ||
    Array.isArray(scratchpadValue) ||
    ttlSeconds === null ||
    !expiresAt ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    taskId,
    scratchpadKey,
    scratchpadValue: scratchpadValue as Record<string, unknown>,
    ttlSeconds,
    expiresAt,
    createdAt,
    updatedAt,
  };
}

function mapTaskMemoryRow(row: unknown): MemoryTaskMemory | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const taskId = asText(r.task_id);
  const stepSeq = asInteger(r.step_seq);
  const outputKey = asText(r.output_key);
  const outputValueHash = asText(r.output_value_hash);
  const artifactRef = r.artifact_ref === null ? null : asText(r.artifact_ref);
  const evidenceLink = r.evidence_link === null ? null : asText(r.evidence_link);
  const retentionWindowSeconds = asInteger(r.retention_window_seconds);
  const expiresAt = asIso(r.expires_at);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);

  if (
    !id ||
    !workspaceId ||
    !taskId ||
    stepSeq === null ||
    !outputKey ||
    !outputValueHash ||
    retentionWindowSeconds === null ||
    !expiresAt ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    taskId,
    stepSeq,
    outputKey,
    outputValueHash,
    artifactRef,
    evidenceLink,
    retentionWindowSeconds,
    expiresAt,
    createdAt,
    updatedAt,
  };
}

function mapUserApprovedFactRow(row: unknown): MemoryUserApprovedFact | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const factKey = asText(r.fact_key);
  const factValueHash = asText(r.fact_value_hash);
  const consentRecordId = asText(r.consent_record_id);
  const expiresAt = r.expires_at === null ? null : asIso(r.expires_at);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);
  const deletedAt = r.deleted_at === null ? null : asIso(r.deleted_at);

  if (
    !id ||
    !workspaceId ||
    !factKey ||
    !factValueHash ||
    !consentRecordId ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    factKey,
    factValueHash,
    consentRecordId,
    expiresAt,
    createdAt,
    updatedAt,
    deletedAt,
  };
}

function mapExternalDataRefRow(row: unknown): MemoryExternalDataRef | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const refKey = asText(r.ref_key);
  const refUrl = r.ref_url === null ? null : asText(r.ref_url);
  const refId = r.ref_id === null ? null : asText(r.ref_id);
  const revalidationWindowSeconds = asInteger(r.revalidation_window_seconds);
  const expiresAt = asIso(r.expires_at);
  const createdAt = asIso(r.created_at);
  const updatedAt = asIso(r.updated_at);

  if (
    !id ||
    !workspaceId ||
    !refKey ||
    revalidationWindowSeconds === null ||
    !expiresAt ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    refKey,
    refUrl,
    refId,
    revalidationWindowSeconds,
    expiresAt,
    createdAt,
    updatedAt,
  };
}

function mapConsentRecordRow(row: unknown): MemoryConsentRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asText(r.id);
  const workspaceId = asText(r.workspace_id);
  const userId = asText(r.user_id);
  const consentType = r.consent_type;
  const granted = r.granted;
  const grantedAt = asIso(r.granted_at);
  const revokedAt = r.revoked_at === null ? null : asIso(r.revoked_at);
  const evidenceHash = asText(r.evidence_hash);
  const createdAt = asIso(r.created_at);

  if (
    !id ||
    !workspaceId ||
    !userId ||
    !consentType ||
    typeof granted !== "boolean" ||
    !grantedAt ||
    !evidenceHash ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    workspaceId,
    userId,
    consentType: consentType as MemoryConsentRecord["consentType"],
    granted,
    grantedAt,
    revokedAt,
    evidenceHash,
    createdAt,
  };
}

export function createMemorySupabaseStore(
  service: SupabaseClient,
): MemoryStore {
  return {
    async upsertMemorySessionScratchpad(input) {
      const result = await service.rpc("upsert_memory_scratchpad", {
        p_workspace_id: input.workspaceId,
        p_task_id: input.taskId,
        p_scratchpad_key: input.scratchpadKey,
        p_scratchpad_value: input.scratchpadValue,
        p_ttl_seconds: input.ttlSeconds,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.scratchpad_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, value: { scratchpadId: id } };
    },

    async deleteMemorySessionScratchpad(input) {
      const result = await service.rpc("delete_memory_scratchpad", {
        p_workspace_id: input.workspaceId,
        p_task_id: input.taskId,
        p_scratchpad_key: input.scratchpadKey,
      });
      if (result.error) return { ok: false, reason: "delete_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.deleted_id) : null;
      if (reason !== "deleted" || !id) {
        return { ok: false, reason: reason ?? "delete_rejected" };
      }
      return { ok: true, value: { scratchpadId: id } };
    },

    async getMemorySessionScratchpad(workspaceId, taskId, scratchpadKey) {
      const result = await service
        .from("memory_session_scratchpad")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("task_id", taskId)
        .eq("scratchpad_key", scratchpadKey)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return mapScratchpadRow(result.data);
    },

    async listMemorySessionScratchpads(workspaceId, taskId) {
      let query = service
        .from("memory_session_scratchpad")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (taskId) {
        query = query.eq("task_id", taskId);
      }
      const result = await query;
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapScratchpadRow(row))
        .filter((row): row is MemorySessionScratchpad => row !== null);
    },

    async upsertMemoryTaskMemory(input) {
      const result = await service.rpc("upsert_memory_task_memory", {
        p_workspace_id: input.workspaceId,
        p_task_id: input.taskId,
        p_step_seq: input.stepSeq,
        p_output_key: input.outputKey,
        p_output_value_hash: input.outputValueHash,
        p_artifact_ref: input.artifactRef,
        p_evidence_link: input.evidenceLink,
        p_retention_window_seconds: input.retentionWindowSeconds,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.memory_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, value: { memoryId: id } };
    },

    async deleteMemoryTaskMemory(input) {
      const result = await service.rpc("delete_memory_task_memory", {
        p_workspace_id: input.workspaceId,
        p_task_id: input.taskId,
        p_step_seq: input.stepSeq,
        p_output_key: input.outputKey,
      });
      if (result.error) return { ok: false, reason: "delete_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.deleted_id) : null;
      if (reason !== "deleted" || !id) {
        return { ok: false, reason: reason ?? "delete_rejected" };
      }
      return { ok: true, value: { memoryId: id } };
    },

    async getMemoryTaskMemory(workspaceId, taskId) {
      const result = await service
        .from("memory_task_memory")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("task_id", taskId)
        .order("step_seq", { ascending: true });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapTaskMemoryRow(row))
        .filter((row): row is MemoryTaskMemory => row !== null);
    },

    async upsertMemoryUserApprovedFact(input) {
      const result = await service.rpc("upsert_memory_user_approved_fact", {
        p_workspace_id: input.workspaceId,
        p_fact_key: input.factKey,
        p_fact_value_hash: input.factValueHash,
        p_consent_record_id: input.consentRecordId,
        p_expires_at: input.expiresAt,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.fact_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, value: { factId: id } };
    },

    async deleteMemoryUserApprovedFact(input) {
      const result = await service.rpc("delete_memory_user_approved_fact", {
        p_workspace_id: input.workspaceId,
        p_fact_key: input.factKey,
      });
      if (result.error) return { ok: false, reason: "delete_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.deleted_id) : null;
      if (reason !== "deleted" || !id) {
        return { ok: false, reason: reason ?? "delete_rejected" };
      }
      return { ok: true, value: { factId: id } };
    },

    async getMemoryUserApprovedFacts(workspaceId) {
      const result = await service
        .from("memory_user_approved_facts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapUserApprovedFactRow(row))
        .filter((row): row is MemoryUserApprovedFact => row !== null);
    },

    async upsertMemoryExternalDataRef(input) {
      const result = await service.rpc("upsert_memory_external_data_ref", {
        p_workspace_id: input.workspaceId,
        p_ref_key: input.refKey,
        p_ref_url: input.refUrl,
        p_ref_id: input.refId,
        p_revalidation_window_seconds: input.revalidationWindowSeconds,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.ref_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, value: { refId: id } };
    },

    async deleteMemoryExternalDataRef(input) {
      const result = await service.rpc("delete_memory_external_data_ref", {
        p_workspace_id: input.workspaceId,
        p_ref_key: input.refKey,
      });
      if (result.error) return { ok: false, reason: "delete_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.deleted_id) : null;
      if (reason !== "deleted" || !id) {
        return { ok: false, reason: reason ?? "delete_rejected" };
      }
      return { ok: true, value: { refId: id } };
    },

    async getMemoryExternalDataRefs(workspaceId) {
      const result = await service
        .from("memory_external_data_refs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapExternalDataRefRow(row))
        .filter((row): row is MemoryExternalDataRef => row !== null);
    },

    async recordMemoryConsent(input) {
      const result = await service.rpc("record_memory_consent", {
        p_workspace_id: input.workspaceId,
        p_user_id: input.userId,
        p_consent_type: input.consentType,
        p_granted: input.granted,
        p_evidence_hash: input.evidenceHash,
      });
      if (result.error) return { ok: false, reason: "upsert_error" };
      const row = firstRow(result.data);
      const reason = row ? asText(row.reason) : null;
      const id = row ? asText(row.consent_id) : null;
      if (reason !== "upserted" || !id) {
        return { ok: false, reason: reason ?? "upsert_rejected" };
      }
      return { ok: true, value: { consentId: id } };
    },

    async getMemoryConsentRecords(workspaceId, userId) {
      const result = await service
        .from("memory_consent_records")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .order("granted_at", { ascending: false });
      if (result.error || !Array.isArray(result.data)) return [];
      return result.data
        .map((row) => mapConsentRecordRow(row))
        .filter((row): row is MemoryConsentRecord => row !== null);
    },
  };
}
