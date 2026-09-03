import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationAutomationMode } from "./conversationSafety";

export type Conversation = {
  id: string;
  user_id: string;
  workspace_id: string;
  ai_employee_id: string | null;
  customer_wa_id: string;
  automation_mode: ConversationAutomationMode;
  human_takeover_at: string | null;
  customer_opted_out_at: string | null;
  customer_opt_out_source: "whatsapp_keyword" | null;
  safety_updated_at: string;
  safety_updated_by: string | null;
  last_message_at: string;
  created_at: string;
};

export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "received" | "delivered" | "read" | "failed" | "draft_blocked";

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  direction: MessageDirection;
  wa_message_id: string | null;
  message_type: string;
  body: string;
  status: MessageStatus;
  sent_at: string | null;
  created_at: string;
};

export type ConversationInbox = {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: ConversationMessage[];
};

export type ConversationInboxResult =
  | { data: ConversationInbox; error: null }
  | { data: null; error: string };

/**
 * Reads through the signed-in user's Supabase session. RLS scopes both
 * conversations and messages to the owner; no service-role key is used here.
 */
export async function getConversationInbox(
  client: SupabaseClient,
  requestedConversationId?: string,
): Promise<ConversationInboxResult> {
  const conversationsResult = await client
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (conversationsResult.error) {
    return { data: null, error: conversationsResult.error.message };
  }

  const conversations = (conversationsResult.data ?? []) as Conversation[];
  const selectedConversation = requestedConversationId
    ? conversations.find((conversation) => conversation.id === requestedConversationId) ?? null
    : conversations[0] ?? null;

  if (!selectedConversation) {
    return {
      data: { conversations, selectedConversation: null, messages: [] },
      error: null,
    };
  }

  const messagesResult = await client
    .from("messages")
    .select("*")
    .eq("conversation_id", selectedConversation.id)
    .order("created_at", { ascending: true });

  if (messagesResult.error) {
    return { data: null, error: messagesResult.error.message };
  }

  return {
    data: {
      conversations,
      selectedConversation,
      messages: (messagesResult.data ?? []) as ConversationMessage[],
    },
    error: null,
  };
}

export function maskWhatsAppId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}

/**
 * Counts the inbound customer turns that appear before a given message index in
 * chronological order. This mirrors the conversation memory (prior inbound
 * customer turns) an AI draft was generated against. It is deterministic and
 * derived purely from the stored message list, so no extra storage is needed
 * and out-of-range indexes simply yield the count for all prior messages.
 */
export function countPriorInboundTurns(
  messages: ConversationMessage[],
  draftIndex: number,
): number {
  let count = 0;
  const bound = Math.min(draftIndex, messages.length);
  for (let i = 0; i < bound; i += 1) {
    if (messages[i] && messages[i].direction === "inbound") count += 1;
  }
  return count;
}

/**
 * Returns the inbound customer turns that appear before a given message index in
 * chronological order. This is the concrete conversation memory an AI draft was
 * generated against. It is derived purely from the stored message list, so no
 * extra storage is needed, and out-of-range indexes simply return all prior
 * inbound messages.
 */
export function priorInboundTurnsBefore(
  messages: ConversationMessage[],
  draftIndex: number,
): ConversationMessage[] {
  const result: ConversationMessage[] = [];
  const bound = Math.min(draftIndex, messages.length);
  for (let i = 0; i < bound; i += 1) {
    const message = messages[i];
    if (message && message.direction === "inbound") result.push(message);
  }
  return result;
}

