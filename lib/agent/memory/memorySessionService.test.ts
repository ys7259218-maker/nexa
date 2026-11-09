/**
 * Phase B B5 memory session service tests (M1).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createMemorySessionService } from "./memorySessionService.ts";
import { createInMemoryMemoryStore } from "./memoryStore.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore() {
  return createInMemoryMemoryStore({ now: () => FIXED_NOW });
}

test("upsertMemorySessionScratchpad creates a scratchpad", async () => {
  const store = makeStore();
  const service = createMemorySessionService(store);
  const result = await service.upsertScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
    scratchpadValue: { key: "value" },
    ttlSeconds: 3600,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.scratchpadId.length > 0, true);
});

test("getMemorySessionScratchpad returns null when no scratchpad exists", async () => {
  const store = makeStore();
  const service = createMemorySessionService(store);
  const scratchpad = await service.getScratchpad("ws-1", "task-1", "key-1");
  assert.equal(scratchpad, null);
});

test("getMemorySessionScratchpad returns the active scratchpad", async () => {
  const store = makeStore();
  const service = createMemorySessionService(store);
  await service.upsertScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
    scratchpadValue: { key: "value" },
    ttlSeconds: 3600,
  });

  const scratchpad = await service.getScratchpad("ws-1", "task-1", "key-1");
  assert.equal(scratchpad?.scratchpadKey, "key-1");
});

test("deleteMemorySessionScratchpad deletes a scratchpad", async () => {
  const store = makeStore();
  const service = createMemorySessionService(store);
  await service.upsertScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
    scratchpadValue: { key: "value" },
    ttlSeconds: 3600,
  });

  const deleted = await service.deleteScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
  });
  assert.equal(deleted.ok, true);

  const afterDelete = await service.getScratchpad("ws-1", "task-1", "key-1");
  assert.equal(afterDelete, null);
});

test("listMemorySessionScratchpads returns only workspace-scoped scratchpads", async () => {
  const store = makeStore();
  const service = createMemorySessionService(store);
  await service.upsertScratchpad({
    workspaceId: "ws-1",
    taskId: "task-1",
    scratchpadKey: "key-1",
    scratchpadValue: { key: "value" },
    ttlSeconds: 3600,
  });
  await service.upsertScratchpad({
    workspaceId: "ws-2",
    taskId: "task-2",
    scratchpadKey: "key-2",
    scratchpadValue: { key: "value" },
    ttlSeconds: 3600,
  });

  const ws1Scratchpads = await service.listScratchpads("ws-1");
  assert.equal(ws1Scratchpads.length, 1);
  assert.equal(ws1Scratchpads[0].taskId, "task-1");

  const ws2Scratchpads = await service.listScratchpads("ws-2");
  assert.equal(ws2Scratchpads.length, 1);
  assert.equal(ws2Scratchpads[0].taskId, "task-2");
});
