import assert from "node:assert/strict";
import test from "node:test";
import { getWorkspaceSafetyState, setWorkspaceAutomationPaused } from "./workspaceSafety.ts";

function queryClient(result: unknown) { const b = { select: () => b, order: () => b, limit: () => b, maybeSingle: async () => result }; return { from: () => b } as never; }
test("workspace safety state maps role and paused status", async () => {
  const result = await getWorkspaceSafetyState(queryClient({ data: { role: "owner", workspace: { id: "w1", name: "Nexa", automation_paused: true } }, error: null }));
  assert.deepEqual(result.data, { id: "w1", name: "Nexa", role: "owner", automationPaused: true });
});
test("workspace safety state sanitizes failures", async () => {
  assert.deepEqual(await getWorkspaceSafetyState(queryClient({ data: null, error: { message: "private" } })), { data: null, error: "Could not load workspace safety controls." });
});
test("workspace safety mutation validates identifiers", async () => {
  assert.deepEqual(await setWorkspaceAutomationPaused({} as never, "", true), { error: "Invalid workspace." });
});
test("workspace safety mutation uses the guarded RPC contract", async () => {
  let called: { name: string; args: unknown } | null = null;
  const client = {
    rpc: async (name: string, args: unknown) => {
      called = { name, args };
      return { error: null };
    },
  };

  assert.deepEqual(await setWorkspaceAutomationPaused(client as never, "workspace-1", false), { error: null });
  assert.deepEqual(called, {
    name: "set_workspace_automation_paused",
    args: { target_workspace_id: "workspace-1", paused: false },
  });
});
