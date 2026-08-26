import assert from "node:assert/strict";
import test from "node:test";

import { canManageWorkspace, canOperateWorkspace, getCurrentWorkspace } from "./workspaces.ts";

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const filters: Array<[string, unknown]> = [];
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
    maybeSingle: async () => result,
  };
  return { client: { from: () => builder } as never, filters };
}

test("getCurrentWorkspace selects the explicit owner-owned personal workspace", async () => {
  const fake = fakeClient({
    data: { role: "owner", workspace: { id: "workspace-1", name: "Nexa", is_personal: true } },
    error: null,
  });
  const result = await getCurrentWorkspace(fake.client);

  assert.deepEqual(result, {
    data: { id: "workspace-1", name: "Nexa", role: "owner" },
    error: null,
  });
  assert.deepEqual(fake.filters, [["role", "owner"], ["workspace.is_personal", true]]);
});

test("getCurrentWorkspace fails safely without a membership", async () => {
  assert.deepEqual(await getCurrentWorkspace(fakeClient({ data: null, error: null }).client), {
    data: null,
    error: "No workspace is assigned to this account.",
  });
  assert.deepEqual(await getCurrentWorkspace(fakeClient({ data: null, error: { message: "private" } }).client), {
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
