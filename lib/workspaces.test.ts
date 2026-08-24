import assert from "node:assert/strict";
import test from "node:test";

import { canManageWorkspace, canOperateWorkspace, getCurrentWorkspace } from "./workspaces.ts";

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => result,
  };
  return { from: () => builder } as never;
}

test("getCurrentWorkspace returns the oldest membership and role", async () => {
  const result = await getCurrentWorkspace(fakeClient({
    data: { role: "owner", workspace: { id: "workspace-1", name: "Nexa" } },
    error: null,
  }));

  assert.deepEqual(result, {
    data: { id: "workspace-1", name: "Nexa", role: "owner" },
    error: null,
  });
});

test("getCurrentWorkspace fails safely without a membership", async () => {
  assert.deepEqual(await getCurrentWorkspace(fakeClient({ data: null, error: null })), {
    data: null,
    error: "No workspace is assigned to this account.",
  });
  assert.deepEqual(await getCurrentWorkspace(fakeClient({ data: null, error: { message: "private" } })), {
    data: null,
    error: "Could not load your workspace.",
  });
});

test("workspace role helpers enforce least privilege", () => {
  assert.equal(canManageWorkspace("owner"), true);
  assert.equal(canManageWorkspace("admin"), true);
  assert.equal(canManageWorkspace("operator"), false);
  assert.equal(canManageWorkspace("viewer"), false);
  assert.equal(canOperateWorkspace("operator"), true);
  assert.equal(canOperateWorkspace("viewer"), false);
});
