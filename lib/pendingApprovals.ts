import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVICE_WINDOW_MS, isWithinServiceWindow } from "./outbound/sessionWindow.ts";

export interface PendingApproval {
  id: string;
  conversation_id: string;
  customer_wa_id: string;
  body: string;
  message_type: string;
  wa_message_id: string | null;
  template_name: string | null;
  created_at: string;
  last_inbound_at: string | null;
  windowOpen: boolean;
}

export interface PendingApprovalList {
  approvals: PendingApproval[];
  /**
   * Exact total of unanswered AI drafts (outbound, draft_blocked), from a
   * head/exact count query, so it is not subject to the returned-row cap.
   */
  total: number;
  /**
   * True when only the newest `PENDING_APPROVALS_LIMIT` drafts were returned
   * and older unseen drafts still wait for a human.
   */
  truncated: boolean;
}

export type PendingApprovalsResult =
  | { data: PendingApprovalList; error: null }
  | { data: null; error: string };

/**
 * Upper bound for the pending-approvals work queue. Keeps the page render and
 * payload bounded regardless of how many unanswered drafts accumulate, while the
 * exact count keeps the true backlog visible.
 */
export const PENDING_APPROVALS_LIMIT = 500;

/**
 * Older than this, an inbound message can never open the 24-hour service window,
 * so it can never make a pending draft approvable. Filtering the inbound scan to
 * only recent messages bounds the query without changing window state.
 */
export const INBOUND_WINDOW_SCAN_MS = SERVICE_WINDOW_MS;

interface ConversationRow {
  id: string;
  customer_wa_id: string;
}

interface DraftRow {
  id: string;
  conversation_id: string;
  customer_wa_id?: string;
  body: string;
  message_type: string;
  wa_message_id: string | null;
  template_name: string | null;
  created_at: string;
}

interface InboundRow {
  conversation_id: string;
  created_at: string;
}

/**
 * Joins conversations, their AI drafts (outbound, draft_blocked), and each
 * conversation's latest inbound timestamp into a bounded work queue. The drafts
 * list is capped, conversations are looked up only for the drafts shown, and the
 * inbound scan is bounded to the service window (older inbound can never open the
 * window). Window state is decided per conversation with the same semantics as
 * the inbox so approve buttons behave identically here.
 */
export async function listPendingApprovals(
  client: SupabaseClient,
  outboundReady: boolean,
  now: Date = new Date(),
): Promise<PendingApprovalsResult> {
  const inboundScanFrom = new Date(now.getTime() - INBOUND_WINDOW_SCAN_MS).toISOString();

  const draftsResult = await client
    .from("messages")
    .select("*")
    .eq("direction", "outbound")
    .eq("status", "draft_blocked")
    .order("created_at", { ascending: false })
    .limit(PENDING_APPROVALS_LIMIT);

  if (draftsResult.error) {
    return { data: null, error: draftsResult.error.message };
  }

  const drafts = (draftsResult.data ?? []) as DraftRow[];
  const conversationIds = [...new Set(drafts.map((draft) => draft.conversation_id))];

  const [countResult, conversationsResult, inboundsResult] = await Promise.all([
    client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "draft_blocked"),
    conversationIds.length > 0
      ? client.from("conversations").select("id,customer_wa_id").in("id", conversationIds)
      : Promise.resolve({ data: [] as ConversationRow[], error: null }),
    client
      .from("messages")
      .select("conversation_id,created_at")
      .eq("direction", "inbound")
      .gte("created_at", inboundScanFrom),
  ]);

  const firstError =
    countResult.error ??
    conversationsResult.error ??
    inboundsResult.error;

  if (firstError) {
    return { data: null, error: firstError.message };
  }

  const conversations = (conversationsResult.data ?? []) as ConversationRow[];
  const customerByConversation = new Map(conversations.map((row) => [row.id, row.customer_wa_id]));

  const lastInboundByConversation = new Map<string, string>();
  for (const row of (inboundsResult.data ?? []) as InboundRow[]) {
    const existing = lastInboundByConversation.get(row.conversation_id);
    if (!existing || row.created_at > existing) {
      lastInboundByConversation.set(row.conversation_id, row.created_at);
    }
  }

  const approvals: PendingApproval[] = drafts.map((draft) => {
    const customer_wa_id = customerByConversation.get(draft.conversation_id) ?? draft.customer_wa_id ?? "";
    const last_inbound_at = lastInboundByConversation.get(draft.conversation_id) ?? null;
    return {
      id: draft.id,
      conversation_id: draft.conversation_id,
      customer_wa_id,
      body: draft.body,
      message_type: draft.message_type,
      wa_message_id: draft.wa_message_id,
      template_name: draft.template_name,
      created_at: draft.created_at,
      last_inbound_at,
      windowOpen: outboundReady && isWithinServiceWindow(last_inbound_at, now),
    };
  });

  const total = countResult.count ?? approvals.length;
  return {
    data: { approvals, total, truncated: approvals.length < total },
    error: null,
  };
}