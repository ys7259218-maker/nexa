/**
 * Phase B B5 memory consent service.
 *
 * M3 user-approved persistent memory requires explicit consent. Consent
 * missing ⇒ not stored. Consent records are auditable.
 */

import type { MemoryConsentType, MemoryStore, StoreOutcome } from "./memoryTypes.ts";

export type MemoryConsentService = Readonly<{
  recordConsent(input: {
    workspaceId: string;
    userId: string;
    consentType: MemoryConsentType;
    granted: boolean;
    evidenceHash: string;
  }): Promise<StoreOutcome<{ consentId: string }>>;
  hasConsent(input: {
    workspaceId: string;
    userId: string;
    consentType: MemoryConsentType;
  }): Promise<boolean>;
  revokeConsent(input: {
    workspaceId: string;
    userId: string;
    consentType: MemoryConsentType;
    evidenceHash: string;
  }): Promise<StoreOutcome<{ consentId: string }>>;
  getConsentRecords(
    workspaceId: string,
    userId: string,
  ): Promise<{
    id: string;
    consentType: MemoryConsentType;
    granted: boolean;
    grantedAt: string;
    revokedAt: string | null;
    evidenceHash: string;
    createdAt: string;
  }[]>;
}>;

export function createMemoryConsentService(
  store: MemoryStore,
): MemoryConsentService {
  return {
    async recordConsent(input) {
      const result = await store.recordMemoryConsent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        consentType: input.consentType,
        granted: input.granted,
        evidenceHash: input.evidenceHash,
      });
      if (!result.ok) return result;
      return { ok: true, value: { consentId: result.value.consentId } };
    },

    async hasConsent(input) {
      const records = await store.getMemoryConsentRecords(
        input.workspaceId,
        input.userId,
      );
      return records.some(
        (r) =>
          r.consentType === input.consentType &&
          r.granted === true &&
          r.revokedAt === null,
      );
    },

    async revokeConsent(input) {
      const records = await store.getMemoryConsentRecords(
        input.workspaceId,
        input.userId,
      );
      const record = records.find((r) => r.consentType === input.consentType);
      if (!record) {
        return { ok: false, reason: "consent_not_found" };
      }
      return store.recordMemoryConsent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        consentType: input.consentType,
        granted: false,
        evidenceHash: input.evidenceHash,
      }).then((result) => {
        if (!result.ok) return result;
        return { ok: true, value: { consentId: record.id } };
      });
    },

    async getConsentRecords(workspaceId, userId) {
      const records = await store.getMemoryConsentRecords(workspaceId, userId);
      return records.map((r) => ({
        id: r.id,
        consentType: r.consentType,
        granted: r.granted,
        grantedAt: r.grantedAt,
        revokedAt: r.revokedAt,
        evidenceHash: r.evidenceHash,
        createdAt: r.createdAt,
      }));
    },
  };
}
