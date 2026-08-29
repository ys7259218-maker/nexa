import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getConversationWorkspaceRole,
  isCustomerOptOutMessage,
  setConversationHumanTakeover,
} from "./conversationSafety.ts";

test("opt-out matching is conservative, normalized, and whole-message only", () => {
  for (const value of [
    "STOP",
    "stop!",
    "Unsubscribe.",
    "Don't message",
    "  message mat karo  ",
    "band karo",
  ]) {
    assert.equal(isCustomerOptOutMessage(value), true, value);
  }

  for (const value of [
    "Do not stop my appointment",
    "Can you cancel my Friday booking?",
    "stop please",
    "restart",
    "",
  ]) {
    assert.equal(isCustomerOptOutMessage(value), false, value);
  }
});

test("human takeover uses only the guarded RPC and sanitizes errors", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;

  assert.deepEqual(
    await setConversationHumanTakeover(client, "workspace-1", "conversation-1", true),
    { error: null },
  );
  assert.deepEqual(calls, [{
    name: "set_conversation_human_takeover",
    args: {
      target_workspace_id: "workspace-1",
      target_conversation_id: "conversation-1",
      enabled: true,
    },
  }]);

  const failing = {
    rpc() {
      return Promise.resolve({ data: null, error: { message: "private database detail" } });
    },
  } as unknown as SupabaseClient;
  const result = await setConversationHumanTakeover(
    failing,
    "workspace-1",
    "conversation-1",
    false,
  );
  assert.equal(result.error, "Could not update conversation safety. No change was made.");
  assert.equal(result.error?.includes("private"), false);
});

test("workspace role lookup is explicitly scoped to workspace and user", async () => {
  const filters: Array<[string, string]> = [];
  const query = {
    select() { return this; },
    eq(column: string, value: string) { filters.push([column, value]); return this; },
    maybeSingle() { return Promise.resolve({ data: { role: "operator" }, error: null }); },
  };
  const client = {
    from(table: string) {
      assert.equal(table, "workspace_members");
      return query;
    },
  } as unknown as SupabaseClient;

  assert.deepEqual(
    await getConversationWorkspaceRole(client, "workspace-1", "user-1"),
    { data: "operator", error: null },
  );
  assert.deepEqual(filters, [
    ["workspace_id", "workspace-1"],
    ["user_id", "user-1"],
  ]);
});
