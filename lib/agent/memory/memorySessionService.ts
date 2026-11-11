/**
 * Phase B B5 memory session service (M1).
 *
 * Task-scoped working state with TTL. Workspace-scoped RLS.
 * Content-free hashes only — never raw content.
 */

import type { MemoryStore, StoreOutcome } from "./memoryTypes.ts";

export type MemorySessionService = Readonly<{
  upsertScratchpad(input: {
    workspaceId: string;
    taskId: string;
    scratchpadKey: string;
    scratchpadValue: Record<string, unknown>;
    ttlSeconds: number;
  }): Promise<StoreOutcome<{ scratchpadId: string }>>;
  deleteScratchpad(input: {
    workspaceId: string;
    taskId: string;
    scratchpadKey: string;
  }): Promise<StoreOutcome<{ scratchpadId: string }>>;
  getScratchpad(
    workspaceId: string,
    taskId: string,
    scratchpadKey: string,
  ): Promise<{
    id: string;
    scratchpadKey: string;
    scratchpadValue: Record<string, unknown>;
    ttlSeconds: number;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
  } | null>;
  listScratchpads(
    workspaceId: string,
    taskId?: string | null,
  ): Promise<{
    id: string;
    taskId: string;
    scratchpadKey: string;
    expiresAt: string;
    updatedAt: string;
  }[]>;
}>;

export function createMemorySessionService(
  store: MemoryStore,
): MemorySessionService {
  return {
    async upsertScratchpad(input) {
      const result = await store.upsertMemorySessionScratchpad({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        scratchpadKey: input.scratchpadKey,
        scratchpadValue: input.scratchpadValue,
        ttlSeconds: input.ttlSeconds,
      });
      if (!result.ok) return result;
      return { ok: true, value: { scratchpadId: result.value.scratchpadId } };
    },

    async deleteScratchpad(input) {
      const result = await store.deleteMemorySessionScratchpad({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        scratchpadKey: input.scratchpadKey,
      });
      if (!result.ok) return result;
      return { ok: true, value: { scratchpadId: result.value.scratchpadId } };
    },

    async getScratchpad(workspaceId, taskId, scratchpadKey) {
      return store.getMemorySessionScratchpad(
        workspaceId,
        taskId,
        scratchpadKey,
      );
    },

    async listScratchpads(workspaceId, taskId) {
      return store.listMemorySessionScratchpads(workspaceId, taskId ?? null);
    },
  };
}
