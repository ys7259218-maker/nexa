import type { SupabaseClient } from "@supabase/supabase-js";

export type Conversation = {
  id: string;
  user_id: string;
  ai_employee_id: string | null;
  customer_wa_id: string;
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

