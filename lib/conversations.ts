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
export type MessageStatus = "received" | "delivered" | "read" | "failed" | "draft_blocked" | "sent";

export function outboundStatusLabel(status: string): string {
  switch (status) {
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "read":
      return "Read";
    case "failed":
      return "Failed to send";
    case "draft_blocked":
      return "draft_blocked";
    default:
      return status;
  }
}

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  direction: MessageDirection;
  wa_message_id: string | null;
  template_name: string | null;
  message_type: string;
  body: string;
  status: MessageStatus;
  failure_reason: string | null;
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
  /**
   * Exact count of conversations the sidebar list queried against (all of them,
   * or the `customer_wa_id` matches when a search is active), from a head/count
   * query — so the list cap never hides the real backlog.
   */
  totalConversations: number;
  /**
   * How many conversation rows the sidebar list actually fetched (the newest
   * `CONVERSATIONS_LIST_LIMIT`, or the matches when searching). A deep-linked
   * conversation is pushed onto `conversations` separately and does not count
   * here, so "showing the newest M" stays truthful.
   */
  listedConversations: number;
  /** True when the sidebar fetches fewer conversations than actually exist. */
  conversationsTruncated: boolean;
  /**
   * Exact count of messages in the selected conversation (head/count), so the
   * 300-message thread cap is never a silent data loss.
   */
  totalMessages: number;
  /** True when the selected thread is capped and older messages exist. */
  messagesTruncated: boolean;
};

export type ConversationTriageFilter = "all" | "drafts" | "flagged";

/**
 * Validates an unknown (search-param) filter value and returns a typed
 * triage filter, defaulting to "all" for absent or unknown input. Never
 * trusts raw query strings.
 */
export function parseConversationTriageFilter(value: unknown): ConversationTriageFilter {
  return value === "drafts" || value === "flagged" ? value : "all";
}

/**
 * Validates unknown search-param digits for customer-phone matching. Only
 * digits survive (international formatting, spaces, and + signs are stripped);
 * empty or non-digit input becomes null (no search).
 */
export function parseCustomerSearchValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function customerWaIdMatches(current: string, query: string | null): boolean {
  if (!query) return true;
  return current.replace(/\D/g, "").includes(query);
}

export type ConversationInboxResult =
  | { data: ConversationInbox; error: null }
  | { data: null; error: string };

/**
 * Upper bound for the conversations the inbox sidebar lists. The list is capped
 * so the page render stays bounded past Supabase's 1,000-row default; a
 * `?conversation=` deep-link is fetched by id separately when it falls outside
 * this cap.
 */
export const CONVERSATIONS_LIST_LIMIT = 200;

/**
 * Upper bound for the message thread shown for the selected conversation,
 * keeping the newest messages (the thread is fetched newest-first and reversed
 * back to chronological order so older turns fall off the display first).
 */
export const INBOX_MESSAGES_LIMIT = 300;

/**
 * Reads through the signed-in user's Supabase session. RLS scopes both
 * conversations and messages to the owner; no service-role key is used here.
 *
 * When `customerSearch` is a non-empty digits-only query, the list is fetched
 * from the database by `customer_wa_id` match rather than just the newest cap,
 * so an operator can reach conversations older than the newest 200. `deepLink`
 * handling is unchanged: an explicit requested id is fetched directly when it
 * falls outside the fetched list.
 */
export async function getConversationInbox(
  client: SupabaseClient,
  requestedConversationId?: string,
  customerSearch?: string | null,
): Promise<ConversationInboxResult> {
  const listBase = client.from("conversations").select("*");
  const countBase = client
    .from("conversations")
    .select("id", { count: "exact", head: true });
  const [conversationsResult, countResult] = await Promise.all([
    customerSearch
      ? listBase
          .ilike("customer_wa_id", `%${customerSearch}%`)
          .order("last_message_at", { ascending: false })
          .limit(CONVERSATIONS_LIST_LIMIT)
      : listBase.order("last_message_at", { ascending: false }).limit(CONVERSATIONS_LIST_LIMIT),
    customerSearch
      ? countBase.ilike("customer_wa_id", `%${customerSearch}%`)
      : countBase,
  ]);

  const firstError = conversationsResult.error ?? countResult.error;
  if (firstError) {
    return { data: null, error: firstError.message };
  }

  const conversations = (conversationsResult.data ?? []) as Conversation[];
  const listedConversations = conversations.length;
  const totalConversations = countResult.count ?? listedConversations;
  let selectedConversation = requestedConversationId
    ? conversations.find((conversation) => conversation.id === requestedConversationId) ?? null
    : conversations[0] ?? null;

  if (requestedConversationId && selectedConversation === null) {
    const directConversationResult = await client
      .from("conversations")
      .select("*")
      .eq("id", requestedConversationId)
      .maybeSingle();

    if (directConversationResult.error) {
      return { data: null, error: directConversationResult.error.message };
    }

    selectedConversation = (directConversationResult.data as Conversation | null) ?? null;
    if (selectedConversation) {
      conversations.push(selectedConversation);
    }
  }

  if (!selectedConversation) {
    return {
      data: {
        conversations,
        selectedConversation: null,
        messages: [],
        pendingDraftCounts: {},
        totalConversations,
        listedConversations,
        conversationsTruncated: listedConversations < totalConversations,
        totalMessages: 0,
        messagesTruncated: false,
      },
      error: null,
    };
  }

  const [messagesResult, messageCountResult] = await Promise.all([
    client
      .from("messages")
      .select("*")
      .eq("conversation_id", selectedConversation.id)
      .order("created_at", { ascending: false })
      .limit(INBOX_MESSAGES_LIMIT),
    client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", selectedConversation.id),
  ]);

  const threadError = messagesResult.error ?? messageCountResult.error;
  if (threadError) {
    return { data: null, error: threadError.message };
  }

  const threadMessages = ((messagesResult.data ?? []) as ConversationMessage[]).reverse();
  const totalMessages = messageCountResult.count ?? threadMessages.length;

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
      messages: threadMessages,
      pendingDraftCounts,
      totalConversations,
      listedConversations,
      conversationsTruncated: listedConversations < totalConversations,
      totalMessages,
      messagesTruncated: threadMessages.length < totalMessages,
    },
    error: null,
  };
}

export function maskWhatsAppId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}

/** Opaque provider message id (wamid): show only the last segment/last 8 char. */
export function maskOpaqueId(value: string): string {
  const trimmed = value.trim();
  const lastSegment = trimmed.split(".").pop() ?? trimmed;
  if (lastSegment.length <= 8) return trimmed;
  return `…${lastSegment.slice(-8)}`;
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

/**
 * Returns the created_at of the newest inbound (customer) message in the
 * conversation, or null when there is no inbound message. This is the value
 * the outbound approve-and-send workflow uses to decide whether the 24-hour
 * customer-service window is open.
 */
export function lastInboundMessageAt(messages: ConversationMessage[]): string | null {
  let newest: string | null = null;
  for (const message of messages) {
    if (message.direction !== "inbound") continue;
    if (newest === null || message.created_at > newest) newest = message.created_at;
  }
  return newest;
}

const WINDOW_MS = 24 * 60 * 60 * 1_000;

/**
 * Milliseconds of free-form customer-service window remaining from the newest
 * inbound message, or null when there is no usable inbound timestamp or the
 * window has already closed.
 */
export function serviceWindowRemainingMs(
  lastInboundAt: string | null,
  now: number | Date = Date.now(),
): number | null {
  const reference = typeof now === "number" ? now : now.getTime();
  if (lastInboundAt == null) return null;
  const lastInboundMs = Date.parse(lastInboundAt);
  if (Number.isNaN(lastInboundMs)) return null;
  const remaining = WINDOW_MS - (reference - lastInboundMs);
  return remaining > 0 ? remaining : null;
}

/** Human "2h 04m" / "37m" rendering for a window remaining duration. */
export function formatWindowRemaining(remainingMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
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

export type ConversationSafetyIndicator =
  | { code: "opted_out"; label: "Opted out"; tone: "danger" }
  | { code: "human_takeover"; label: "Human takeover"; tone: "warning" }
  | { code: "unassigned"; label: "No AI employee"; tone: "muted" }
  | null;

/**
 * Returns the highest-priority safety state to surface for a conversation,
 * derived purely from fields already present on the conversation row. It is
 * deterministic and requires no additional queries.
 */
export function conversationSafetyIndicator(input: {
  customer_opted_out_at: string | null;
  automation_mode: ConversationAutomationMode;
  human_takeover_at: string | null;
  ai_employee_id: string | null;
}): ConversationSafetyIndicator {
  if (input.customer_opted_out_at) {
    return { code: "opted_out", label: "Opted out", tone: "danger" };
  }
  if (input.automation_mode === "human" || input.human_takeover_at) {
    return { code: "human_takeover", label: "Human takeover", tone: "warning" };
  }
  if (!input.ai_employee_id) {
    return { code: "unassigned", label: "No AI employee", tone: "muted" };
  }
  return null;
}

