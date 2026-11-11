/**
 * Phase B B5 memory external data refs service tests (M5).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryExternalDataRefsService } from "./memoryExternalDataRefsService.ts";
import { createInMemoryMemoryStore } from "./memoryStore.ts";

const FIXED_NOW = new Date("2026-11-09T17:00:00Z");

function makeStore() {
  return createInMemoryMemoryStore({ now: () => FIXED_NOW });
}

test("upsertRef creates an external data ref", async () => {
  const store = makeStore();
  const service = createMemoryExternalDataRefsService(store);
  const result = await service.upsertRef({
    workspaceId: "ws-1",
    refKey: "ref-1",
    refUrl: "https://example.com/data",
    refId: null,
    revalidationWindowSeconds: 3600,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected ok");
  assert.equal(result.value.refId.length > 0, true);
});

test("getRefs returns workspace-scoped refs", async () => {
  const store = makeStore();
  const service = createMemoryExternalDataRefsService(store);
  await service.upsertRef({
    workspaceId: "ws-1",
    refKey: "ref-1",
    refUrl: "https://example.com/data",
    refId: null,
    revalidationWindowSeconds: 3600,
  });
  await service.upsertRef({
    workspaceId: "ws-2",
    refKey: "ref-2",
    refUrl: null,
    refId: "ext-2",
    revalidationWindowSeconds: 3600,
  });

  const ws1Refs = await service.getRefs("ws-1");
  assert.equal(ws1Refs.length, 1);
  assert.equal(ws1Refs[0].refKey, "ref-1");

  const ws2Refs = await service.getRefs("ws-2");
  assert.equal(ws2Refs.length, 1);
  assert.equal(ws2Refs[0].refKey, "ref-2");
});

test("deleteRef deletes an external data ref", async () => {
  const store = makeStore();
  const service = createMemoryExternalDataRefsService(store);
  await service.upsertRef({
    workspaceId: "ws-1",
    refKey: "ref-1",
    refUrl: "https://example.com/data",
    refId: null,
    revalidationWindowSeconds: 3600,
  });

  const deleted = await service.deleteRef({ workspaceId: "ws-1", refKey: "ref-1" });
  assert.equal(deleted.ok, true);

  const refs = await service.getRefs("ws-1");
  assert.equal(refs.length, 0);
});
