/**
 * Phase B B5 memory system store contracts.
 *
 * Deterministic in-memory store with validation. A Supabase implementation
 * maps every write to the reviewed SECURITY DEFINER RPCs from migration
 * `20261109040000_memory_system_b5.sql`. Content-free hashes only — never
 * raw content or plaintext secrets.
 */

import { randomUUID } from "node:crypto";

import {
  HASH_PATTERN,
  MEMORY_CONSENT_TYPES,
  MEMORY_TTL_MAX,
  MEMORY_TTL_MIN,
  type MemoryConsentRecord,
  type MemoryConsentType,
  type MemoryExternalDataRef,
  type MemorySessionScratchpad,
  type MemoryStore,
  type MemoryTaskMemory,
  type MemoryUserApprovedFact,
  type StoreOutcome,
  isMemoryConsentType,
  isSha256Hex,
  isValidMemoryTtl,
} from "./memoryTypes.ts";

const NON_EMPTY_ID_PATTERN = /^[-A-Za-z0-9:_.]{1,200}$/;

function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && NON_EMPTY_ID_PATTERN.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function cloneScratchpad(row: MemorySessionScratchpad): MemorySessionScratchpad {
  return { ...row };
}

function cloneTaskMemory(row: MemoryTaskMemory): MemoryTaskMemory {
  return { ...row };
}

function cloneUserApprovedFact(row: MemoryUserApprovedFact): MemoryUserApprovedFact {
  return { ...row };
}

function cloneExternalDataRef(row: MemoryExternalDataRef): MemoryExternalDataRef {
  return { ...row };
}

function cloneConsentRecord(row: MemoryConsentRecord): MemoryConsentRecord {
  return { ...row };
}

export function createInMemoryMemoryStore(
  options: {
    now?: () => Date;
    idFactory?: () => string;
  } = {},
): MemoryStore {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => randomUUID());

  const scratchpads = new Map<string, MemorySessionScratchpad>();
  const scratchpadsByTask = new Map<string, string>(); // taskId -> scratchpadId
  const taskMemories = new Map<string, MemoryTaskMemory>();
  const taskMemoriesByTask = new Map<string, string[]>(); // taskId -> memoryIds
  const userApprovedFacts = new Map<string, MemoryUserApprovedFact>();
  const factsByWorkspaceKey = new Map<string, string>(); // workspaceId:factKey -> factId
  const externalDataRefs = new Map<string, MemoryExternalDataRef>();
  const refsByWorkspaceKey = new Map<string, string>(); // workspaceId:refKey -> refId
  const consentRecords = new Map<string, MemoryConsentRecord>();
  const consentsByWorkspaceUserType = new Map<string, string>(); // workspaceId:userId:consentType -> consentId

  return {
    async upsertMemorySessionScratchpad(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.taskId)) return { ok: false, reason: "invalid_task" };
      if (!isNonEmptyId(input.scratchpadKey)) return { ok: false, reason: "invalid_scratchpad_key" };
      if (
        input.scratchpadValue === null ||
        typeof input.scratchpadValue !== "object" ||
        Array.isArray(input.scratchpadValue)
      ) {
        return { ok: false, reason: "invalid_scratchpad_value" };
      }
      if (!isValidMemoryTtl(input.ttlSeconds)) return { ok: false, reason: "invalid_ttl_seconds" };

      const key = `${input.workspaceId}:${input.taskId}:${input.scratchpadKey}`;
      const existing = scratchpads.get(scratchpadsByTask.get(key) ?? "");

      const scratchpad: MemorySessionScratchpad = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        scratchpadKey: input.scratchpadKey,
        scratchpadValue: input.scratchpadValue,
        ttlSeconds: input.ttlSeconds,
        expiresAt: new Date(now().getTime() + input.ttlSeconds * 1000).toISOString(),
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
      };

      scratchpads.set(scratchpad.id, scratchpad);
      scratchpadsByTask.set(key, scratchpad.id);
      return { ok: true, value: { scratchpadId: scratchpad.id } };
    },

    async deleteMemorySessionScratchpad(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.taskId)) return { ok: false, reason: "invalid_task" };
      if (!isNonEmptyId(input.scratchpadKey)) return { ok: false, reason: "invalid_scratchpad_key" };

      const key = `${input.workspaceId}:${input.taskId}:${input.scratchpadKey}`;
      const scratchpadId = scratchpadsByTask.get(key);
      if (!scratchpadId) return { ok: false, reason: "scratchpad_not_found" };

      const scratchpad = scratchpads.get(scratchpadId);
      if (!scratchpad || scratchpad.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "scratchpad_not_found" };
      }

      scratchpads.delete(scratchpadId);
      scratchpadsByTask.delete(key);
      return { ok: true, value: { scratchpadId } };
    },

    async getMemorySessionScratchpad(workspaceId, taskId, scratchpadKey) {
      if (!isNonEmptyId(workspaceId)) return null;
      if (!isNonEmptyId(taskId)) return null;
      if (!isNonEmptyId(scratchpadKey)) return null;

      const key = `${workspaceId}:${taskId}:${scratchpadKey}`;
      const scratchpadId = scratchpadsByTask.get(key);
      if (!scratchpadId) return null;

      const scratchpad = scratchpads.get(scratchpadId);
      return scratchpad?.workspaceId === workspaceId ? cloneScratchpad(scratchpad) : null;
    },

    async listMemorySessionScratchpads(workspaceId, taskId) {
      if (!isNonEmptyId(workspaceId)) return [];
      return [...scratchpads.values()]
        .filter((s) => s.workspaceId === workspaceId && (!taskId || s.taskId === taskId))
        .map(cloneScratchpad);
    },

    async upsertMemoryTaskMemory(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.taskId)) return { ok: false, reason: "invalid_task" };
      if (!Number.isInteger(input.stepSeq) || input.stepSeq < 1)
        return { ok: false, reason: "invalid_step_seq" };
      if (!isNonEmptyId(input.outputKey)) return { ok: false, reason: "invalid_output_key" };
      if (!isSha256Hex(input.outputValueHash)) return { ok: false, reason: "invalid_output_value_hash" };
      if (!isValidMemoryTtl(input.retentionWindowSeconds))
        return { ok: false, reason: "invalid_retention_window_seconds" };

      const key = `${input.workspaceId}:${input.taskId}:${input.stepSeq}:${input.outputKey}`;
      const existing = taskMemories.get(
        taskMemoriesByTask.get(input.taskId)?.find((mid) => {
          const m = taskMemories.get(mid);
          return m && m.stepSeq === input.stepSeq && m.outputKey === input.outputKey ? mid : null;
        }) ?? ""
      );

      const taskMemory: MemoryTaskMemory = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        stepSeq: input.stepSeq,
        outputKey: input.outputKey,
        outputValueHash: input.outputValueHash,
        artifactRef: input.artifactRef ?? null,
        evidenceLink: input.evidenceLink ?? null,
        retentionWindowSeconds: input.retentionWindowSeconds,
        expiresAt: new Date(now().getTime() + input.retentionWindowSeconds * 1000).toISOString(),
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
      };

      taskMemories.set(taskMemory.id, taskMemory);
      const taskMemoryIds = taskMemoriesByTask.get(input.taskId) ?? [];
      if (!taskMemoryIds.includes(taskMemory.id)) {
        taskMemoryIds.push(taskMemory.id);
        taskMemoriesByTask.set(input.taskId, taskMemoryIds);
      }
      return { ok: true, value: { memoryId: taskMemory.id } };
    },

    async deleteMemoryTaskMemory(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.taskId)) return { ok: false, reason: "invalid_task" };
      if (!Number.isInteger(input.stepSeq) || input.stepSeq < 1)
        return { ok: false, reason: "invalid_step_seq" };
      if (!isNonEmptyId(input.outputKey)) return { ok: false, reason: "invalid_output_key" };

      const key = `${input.workspaceId}:${input.taskId}:${input.stepSeq}:${input.outputKey}`;
      const memoryId = taskMemoriesByTask.get(input.taskId)?.find((mid) => {
        const m = taskMemories.get(mid);
        return m && m.stepSeq === input.stepSeq && m.outputKey === input.outputKey ? mid : null;
      });
      if (!memoryId) return { ok: false, reason: "task_memory_not_found" };

      const memory = taskMemories.get(memoryId);
      if (!memory || memory.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "task_memory_not_found" };
      }

      taskMemories.delete(memoryId);
      return { ok: true, value: { memoryId } };
    },

    async getMemoryTaskMemory(workspaceId, taskId) {
      if (!isNonEmptyId(workspaceId)) return [];
      if (!isNonEmptyId(taskId)) return [];
      return [...taskMemories.values()]
        .filter((m) => m.workspaceId === workspaceId && m.taskId === taskId)
        .sort((a, b) => a.stepSeq - b.stepSeq)
        .map(cloneTaskMemory);
    },

    async upsertMemoryUserApprovedFact(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.factKey)) return { ok: false, reason: "invalid_fact_key" };
      if (!isSha256Hex(input.factValueHash)) return { ok: false, reason: "invalid_fact_value_hash" };
      if (!isNonEmptyId(input.consentRecordId)) return { ok: false, reason: "invalid_consent_record_id" };

      const consent = consentRecords.get(input.consentRecordId);
      if (!consent) return { ok: false, reason: "consent_not_found_or_revoked" };
      if (consent.workspaceId !== input.workspaceId)
        return { ok: false, reason: "consent_workspace_mismatch" };
      if (!consent.granted || consent.revokedAt !== null)
        return { ok: false, reason: "consent_not_found_or_revoked" };

      if (input.expiresAt !== null && !isIsoTimestamp(input.expiresAt))
        return { ok: false, reason: "invalid_expires_at" };
      if (input.expiresAt !== null && new Date(input.expiresAt) <= now())
        return { ok: false, reason: "invalid_expires_at" };

      const key = `${input.workspaceId}:${input.factKey}`;
      const existing = userApprovedFacts.get(factsByWorkspaceKey.get(key) ?? "");

      const fact: MemoryUserApprovedFact = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        factKey: input.factKey,
        factValueHash: input.factValueHash,
        consentRecordId: input.consentRecordId,
        expiresAt: input.expiresAt ?? null,
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
        deletedAt: null,
      };

      userApprovedFacts.set(fact.id, fact);
      factsByWorkspaceKey.set(key, fact.id);
      return { ok: true, value: { factId: fact.id } };
    },

    async deleteMemoryUserApprovedFact(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.factKey)) return { ok: false, reason: "invalid_fact_key" };

      const key = `${input.workspaceId}:${input.factKey}`;
      const factId = factsByWorkspaceKey.get(key);
      if (!factId) return { ok: false, reason: "fact_not_found" };

      const fact = userApprovedFacts.get(factId);
      if (!fact || fact.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "fact_not_found" };
      }

      const updated: MemoryUserApprovedFact = {
        ...fact,
        deletedAt: now().toISOString(),
        updatedAt: now().toISOString(),
      };
      userApprovedFacts.set(fact.id, updated);
      return { ok: true, value: { factId } };
    },

    async getMemoryUserApprovedFacts(workspaceId) {
      if (!isNonEmptyId(workspaceId)) return [];
      return [...userApprovedFacts.values()]
        .filter((f) => f.workspaceId === workspaceId && f.deletedAt === null)
        .map(cloneUserApprovedFact);
    },

    async upsertMemoryExternalDataRef(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.refKey)) return { ok: false, reason: "invalid_ref_key" };
      if (input.refUrl === null && input.refId === null)
        return { ok: false, reason: "invalid_ref" };
      if (!isValidMemoryTtl(input.revalidationWindowSeconds))
        return { ok: false, reason: "invalid_revalidation_window_seconds" };

      const key = `${input.workspaceId}:${input.refKey}`;
      const existing = externalDataRefs.get(refsByWorkspaceKey.get(key) ?? "");

      const ref: MemoryExternalDataRef = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        refKey: input.refKey,
        refUrl: input.refUrl ?? null,
        refId: input.refId ?? null,
        revalidationWindowSeconds: input.revalidationWindowSeconds,
        expiresAt: new Date(now().getTime() + input.revalidationWindowSeconds * 1000).toISOString(),
        createdAt: existing?.createdAt ?? now().toISOString(),
        updatedAt: now().toISOString(),
      };

      externalDataRefs.set(ref.id, ref);
      refsByWorkspaceKey.set(key, ref.id);
      return { ok: true, value: { refId: ref.id } };
    },

    async deleteMemoryExternalDataRef(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.refKey)) return { ok: false, reason: "invalid_ref_key" };

      const key = `${input.workspaceId}:${input.refKey}`;
      const refId = refsByWorkspaceKey.get(key);
      if (!refId) return { ok: false, reason: "external_data_ref_not_found" };

      const ref = externalDataRefs.get(refId);
      if (!ref || ref.workspaceId !== input.workspaceId) {
        return { ok: false, reason: "external_data_ref_not_found" };
      }

      externalDataRefs.delete(refId);
      refsByWorkspaceKey.delete(key);
      return { ok: true, value: { refId } };
    },

    async getMemoryExternalDataRefs(workspaceId) {
      if (!isNonEmptyId(workspaceId)) return [];
      return [...externalDataRefs.values()]
        .filter((r) => r.workspaceId === workspaceId)
        .map(cloneExternalDataRef);
    },

    async recordMemoryConsent(input) {
      if (!isNonEmptyId(input.workspaceId)) return { ok: false, reason: "invalid_workspace" };
      if (!isNonEmptyId(input.userId)) return { ok: false, reason: "invalid_user_id" };
      if (!isMemoryConsentType(input.consentType)) return { ok: false, reason: "invalid_consent_type" };
      if (typeof input.granted !== "boolean") return { ok: false, reason: "invalid_granted" };
      if (!isSha256Hex(input.evidenceHash)) return { ok: false, reason: "invalid_evidence_hash" };

      const key = `${input.workspaceId}:${input.userId}:${input.consentType}`;
      const existing = consentRecords.get(consentsByWorkspaceUserType.get(key) ?? "");

      const consent: MemoryConsentRecord = {
        id: existing?.id ?? idFactory(),
        workspaceId: input.workspaceId,
        userId: input.userId,
        consentType: input.consentType,
        granted: input.granted,
        grantedAt: now().toISOString(),
        revokedAt: input.granted ? null : now().toISOString(),
        evidenceHash: input.evidenceHash,
        createdAt: existing?.createdAt ?? now().toISOString(),
      };

      consentRecords.set(consent.id, consent);
      consentsByWorkspaceUserType.set(key, consent.id);
      return { ok: true, value: { consentId: consent.id } };
    },

    async getMemoryConsentRecords(workspaceId, userId) {
      if (!isNonEmptyId(workspaceId)) return [];
      if (!isNonEmptyId(userId)) return [];
      return [...consentRecords.values()]
        .filter((c) => c.workspaceId === workspaceId && c.userId === userId)
        .map(cloneConsentRecord);
    },
  };
}

export type { MemoryStore };
