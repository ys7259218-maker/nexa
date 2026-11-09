/**
 * Phase B B5 memory external data refs service (M5).
 *
 * URLs/IDs only, never bulk-fetched copies without retention policy.
 * References-only default.
 */

import type { MemoryStore, StoreOutcome } from "./memoryTypes.ts";

export type MemoryExternalDataRefsService = Readonly<{
  upsertRef(input: {
    workspaceId: string;
    refKey: string;
    refUrl: string | null;
    refId: string | null;
    revalidationWindowSeconds: number;
  }): Promise<StoreOutcome<{ refId: string }>>;
  deleteRef(input: {
    workspaceId: string;
    refKey: string;
  }): Promise<StoreOutcome<{ refId: string }>>;
  getRefs(
    workspaceId: string,
  ): Promise<{
    id: string;
    refKey: string;
    refUrl: string | null;
    refId: string | null;
    expiresAt: string;
    createdAt: string;
  }[]>;
}>;

export function createMemoryExternalDataRefsService(
  store: MemoryStore,
): MemoryExternalDataRefsService {
  return {
    async upsertRef(input) {
      const result = await store.upsertMemoryExternalDataRef({
        workspaceId: input.workspaceId,
        refKey: input.refKey,
        refUrl: input.refUrl,
        refId: input.refId,
        revalidationWindowSeconds: input.revalidationWindowSeconds,
      });
      if (!result.ok) return result;
      return { ok: true, value: { refId: result.value.refId } };
    },

    async deleteRef(input) {
      const result = await store.deleteMemoryExternalDataRef({
        workspaceId: input.workspaceId,
        refKey: input.refKey,
      });
      if (!result.ok) return result;
      return { ok: true, value: { refId: result.value.refId } };
    },

    async getRefs(workspaceId) {
      const records = await store.getMemoryExternalDataRefs(workspaceId);
      return records.map((r) => ({
        id: r.id,
        refKey: r.refKey,
        refUrl: r.refUrl,
        refId: r.refId,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      }));
    },
  };
}
