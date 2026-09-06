import type { SupabaseClient } from "@supabase/supabase-js";
import { isWithinServiceWindow } from "./outbound/sessionWindow.ts";

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

export type PendingApprovalsResult =
  | { data: PendingApproval[]; error: null }
  | { data: null; error: string };

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
 * conversation's latest inbound timestamp into a work queue. Window state is
 * decided per conversation with the same semantics as the inbox so approve
 * buttons behave identically here.
 */
export async function listPendingApprovals(
  client: SupabaseClient,
  outboundReady: boolean,
  now: Date = new Date(),
): Promise<PendingApprovalsResult> {
  const [conversationsResult, draftsResult, inboundsResult] = await Promise.all([
    client.from("conversations").select("id,customer_wa_id"),
    client
      .from("messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("status", "draft_blocked")
      .order("created_at", { ascending: false }),
    client
      .from("messages")
      .select("conversation_id,created_at")
      .eq("direction", "inbound"),
  ]);

  const firstError =
    conversationsResult.error ??
    draftsResult.error ??
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

  const drafts = (draftsResult.data ?? []) as DraftRow[];
  const data: PendingApproval[] = drafts.map((draft) => {
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

  return { data, error: null };
}