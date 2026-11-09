/**
 * Phase B B5 memory task service (M2).
 *
 * Structured step outputs, artifacts, evidence links with task retention
 * window. Workspace-scoped RLS. Content-free hashes only.
 */

import type { MemoryStore, StoreOutcome } from "./memoryTypes.ts";

export type MemoryTaskService = Readonly<{
  upsertTaskMemory(input: {
    workspaceId: string;
    taskId: string;
    stepSeq: number;
    outputKey: string;
    outputValueHash: string;
    artifactRef: string | null;
    evidenceLink: string | null;
    retentionWindowSeconds: number;
  }): Promise<StoreOutcome<{ memoryId: string }>>;
  deleteTaskMemory(input: {
    workspaceId: string;
    taskId: string;
    stepSeq: number;
    outputKey: string;
  }): Promise<StoreOutcome<{ memoryId: string }>>;
  getTaskMemory(
    workspaceId: string,
    taskId: string,
  ): Promise<{
    id: string;
    stepSeq: number;
    outputKey: string;
    outputValueHash: string;
    artifactRef: string | null;
    evidenceLink: string | null;
    expiresAt: string;
    createdAt: string;
  }[]>;
}>;

export function createMemoryTaskService(
  store: MemoryStore,
): MemoryTaskService {
  return {
    async upsertTaskMemory(input) {
      const result = await store.upsertMemoryTaskMemory({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        stepSeq: input.stepSeq,
        outputKey: input.outputKey,
        outputValueHash: input.outputValueHash,
        artifactRef: input.artifactRef,
        evidenceLink: input.evidenceLink,
        retentionWindowSeconds: input.retentionWindowSeconds,
      });
      if (!result.ok) return result;
      return { ok: true, value: { memoryId: result.value.memoryId } };
    },

    async deleteTaskMemory(input) {
      const result = await store.deleteMemoryTaskMemory({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        stepSeq: input.stepSeq,
        outputKey: input.outputKey,
      });
      if (!result.ok) return result;
      return { ok: true, value: { memoryId: result.value.memoryId } };
    },

    async getTaskMemory(workspaceId, taskId) {
      return store.getMemoryTaskMemory(workspaceId, taskId);
    },
  };
}
