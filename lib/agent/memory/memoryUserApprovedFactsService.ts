/**
 * Phase B B5 memory user-approved facts service (M3).
 *
 * Explicit facts the user chose to keep, until user edits/deletes.
 * Requires explicit consent — consent missing ⇒ not stored.
 * Consent records are auditable.
 */

import type { MemoryStore, StoreOutcome } from "./memoryTypes.ts";

export type MemoryUserApprovedFactsService = Readonly<{
  upsertFact(input: {
    workspaceId: string;
    factKey: string;
    factValueHash: string;
    consentRecordId: string;
    expiresAt: string | null;
  }): Promise<StoreOutcome<{ factId: string }>>;
  deleteFact(input: {
    workspaceId: string;
    factKey: string;
  }): Promise<StoreOutcome<{ factId: string }>>;
  getFacts(
    workspaceId: string,
  ): Promise<{
    id: string;
    factKey: string;
    factValueHash: string;
    consentRecordId: string;
    expiresAt: string | null;
    createdAt: string;
    deletedAt: string | null;
  }[]>;
}>;

export function createMemoryUserApprovedFactsService(
  store: MemoryStore,
): MemoryUserApprovedFactsService {
  return {
    async upsertFact(input) {
      const result = await store.upsertMemoryUserApprovedFact({
        workspaceId: input.workspaceId,
        factKey: input.factKey,
        factValueHash: input.factValueHash,
        consentRecordId: input.consentRecordId,
        expiresAt: input.expiresAt,
      });
      if (!result.ok) return result;
      return { ok: true, value: { factId: result.value.factId } };
    },

    async deleteFact(input) {
      const result = await store.deleteMemoryUserApprovedFact({
        workspaceId: input.workspaceId,
        factKey: input.factKey,
      });
      if (!result.ok) return result;
      return { ok: true, value: { factId: result.value.factId } };
    },

    async getFacts(workspaceId) {
      const records = await store.getMemoryUserApprovedFacts(workspaceId);
      return records.map((f) => ({
        id: f.id,
        factKey: f.factKey,
        factValueHash: f.factValueHash,
        consentRecordId: f.consentRecordId,
        expiresAt: f.expiresAt,
        createdAt: f.createdAt,
        deletedAt: f.deletedAt,
      }));
    },
  };
}
