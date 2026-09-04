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
  /**
   * Number of unanswered AI drafts (outbound, draft_blocked) per conversation id.
   * A value above zero means a recorded customer message still needs a human
   * before it can be sent.
   */
  pendingDraftCounts: Record<string, number>;
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
      data: { conversations, selectedConversation: null, messages: [], pendingDraftCounts: {} },
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

  const conversationIds = conversations.map((conversation) => conversation.id);
  const pendingDraftCounts: Record<string, number> = {};
  if (conversationIds.length > 0) {
    const draftsResult = await client
      .from("messages")
      .select("conversation_id")
      .eq("direction", "outbound")
      .eq("status", "draft_blocked")
      .in("conversation_id", conversationIds);
    if (draftsResult.error) {
      return { data: null, error: draftsResult.error.message };
    }
    for (const row of (draftsResult.data ?? []) as { conversation_id: string }[]) {
      pendingDraftCounts[row.conversation_id] = (pendingDraftCounts[row.conversation_id] ?? 0) + 1;
    }
  }

  return {
    data: {
      conversations,
      selectedConversation,
      messages: (messagesResult.data ?? []) as ConversationMessage[],
      pendingDraftCounts,
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

export type DraftGateReasonCode =
  | "customer_opted_out"
  | "human_takeover"
  | "no_employee_assigned"
  | "no_outbound_pending";

export type DraftGateReason = {
  code: DraftGateReasonCode;
  summary: string;
};

/**
 * Explains why a selected conversation has no pending AI draft to review for the
 * latest customer message. It only reports when the most recent stored message is
 * an inbound (customer) turn that is not already answered by a pending outbound
 * draft. Reasons are derived purely from the conversation row and the message
 * thread already held in memory, so no extra queries or storage are needed and the
 * function is fully deterministic.
 */
export function explainMissingDraft(input: {
  conversation: Conversation | null;
  messages: ConversationMessage[];
  pendingDraftCounts: Record<string, number>;
}): DraftGateReason[] {
  const { conversation, messages, pendingDraftCounts } = input;
  if (!conversation) return [];

  const last = messages[messages.length - 1];
  if (!last || last.direction !== "inbound") return [];
  if ((pendingDraftCounts[conversation.id] ?? 0) > 0) return [];

  const reasons: DraftGateReason[] = [];
  if (conversation.customer_opted_out_at) {
    reasons.push({ code: "customer_opted_out", summary: "This customer has opted out of messages. AI drafts stay blocked." });
  } else if (conversation.automation_mode === "human" || conversation.human_takeover_at) {
    reasons.push({ code: "human_takeover", summary: "Human takeover is active for this conversation, so AI draft generation is paused." });
  } else if (!conversation.ai_employee_id) {
    reasons.push({ code: "no_employee_assigned", summary: "No AI employee is assigned to this conversation, so no draft is generated for inbound messages." });
  } else {
    reasons.push({ code: "no_outbound_pending", summary: "No AI draft has been generated for the latest customer message yet." });
  }
  return reasons;
}

