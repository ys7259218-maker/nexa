import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorkspaceRole } from "./workspaces";

export type ConversationAutomationMode = "ai" | "human";

const RAW_OPT_OUT_PHRASES = [
  "stop",
  "stop all",
  "stop messages",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "do not message",
  "don't message",
  "message mat karo",
  "band karo",
] as const;

function normalizeOptOutText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPT_OUT_PHRASES = new Set(RAW_OPT_OUT_PHRASES.map(normalizeOptOutText));

export function isCustomerOptOutMessage(value: string): boolean {
  return OPT_OUT_PHRASES.has(normalizeOptOutText(value));
}

export function isConversationSafetyEnabled(): boolean {
  return process.env.CONVERSATION_SAFETY_ENABLED === "true";
}

export async function setConversationHumanTakeover(
  client: SupabaseClient,
  workspaceId: string,
  conversationId: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
  if (!workspaceId || !conversationId) {
    return { error: "Invalid conversation safety request." };
  }

  const { error } = await client.rpc("set_conversation_human_takeover", {
    target_workspace_id: workspaceId,
    target_conversation_id: conversationId,
    enabled,
  });

  return {
    error: error ? "Could not update conversation safety. No change was made." : null,
  };
}

export async function getConversationWorkspaceRole(
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<{ data: WorkspaceRole | null; error: string | null }> {
  if (!workspaceId || !userId) {
    return { data: null, error: "Invalid workspace membership request." };
  }

  const { data, error } = await client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { data: null, error: "Could not verify conversation permissions." };
  }

  return {
    data: (data as { role: WorkspaceRole }).role,
    error: null,
  };
}
