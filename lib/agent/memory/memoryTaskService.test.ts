/**
 * Phase B B5 memory task service tests (M2).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryTaskService } from "./memoryTaskService.ts";
import { createInMemoryMemoryStore } from "./memoryStore.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore() {
  return createInMemoryMemoryStore({ now: () => FIXED_NOW });
}

test("upsertMemoryTaskMemory creates a task memory", async () => {
  const store = makeStore();
  const service = createMemoryTaskService(store);
  const result = await service.upsertTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.memoryId.length > 0, true);
});

test("getMemoryTaskMemory returns task memories in step order", async () => {
  const store = makeStore();
  const service = createMemoryTaskService(store);
  await service.upsertTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 2,
    outputKey: "output-2",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });
  await service.upsertTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });

  const memories = await service.getTaskMemory("ws-1", "task-1");
  assert.equal(memories.length, 2);
  assert.equal(memories[0].stepSeq, 1);
  assert.equal(memories[1].stepSeq, 2);
});

test("deleteMemoryTaskMemory deletes a task memory", async () => {
  const store = makeStore();
  const service = createMemoryTaskService(store);
  await service.upsertTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
    outputValueHash: "0000000000000000000000000000000000000000000000000000000000000000",
    artifactRef: null,
    evidenceLink: null,
    retentionWindowSeconds: 3600,
  });

  const deleted = await service.deleteTaskMemory({
    workspaceId: "ws-1",
    taskId: "task-1",
    stepSeq: 1,
    outputKey: "output-1",
  });
  assert.equal(deleted.ok, true);

  const memories = await service.getTaskMemory("ws-1", "task-1");
  assert.equal(memories.length, 0);
});
