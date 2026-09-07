import type { SupabaseClient } from "@supabase/supabase-js";
import { isWithinServiceWindow } from "./outbound/sessionWindow.ts";

export interface FailedSend {
  id: string;
  conversation_id: string;
  customer_wa_id: string;
  body: string;
  message_type: string;
  wa_message_id: string | null;
  template_name: string | null;
  failure_reason: string | null;
  created_at: string;
  last_inbound_at: string | null;
  windowOpen: boolean;
  retryable: boolean;
}

export type FailedSendsResult =
  | { data: FailedSend[]; error: null }
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
  failure_reason: string | null;
  created_at: string;
}

interface InboundRow {
  conversation_id: string;
  created_at: string;
}

/**
 * Builds a retry work queue from the owner's failed outbound messages
 * (RLS-scoped, signed-in client). Window state uses the same semantics as the
 * inbox; a send is only "retryable" when outbound is ready, the 24-hour window
 * is open, and the message was free-form (Meta template components are not
 * stored, so template-based sends cannot be auto-retried).
 */
export async function listFailedSends(
  client: SupabaseClient,
  outboundReady: boolean,
  now: Date = new Date(),
): Promise<FailedSendsResult> {
  const [conversationsResult, sendsResult, inboundsResult] = await Promise.all([
    client.from("conversations").select("id,customer_wa_id"),
    client
      .from("messages")
      .select("*")
      .eq("direction", "outbound")
      .eq("status", "failed")
      .order("created_at", { ascending: false }),
    client
      .from("messages")
      .select("conversation_id,created_at")
      .eq("direction", "inbound"),
  ]);

  const firstError =
    conversationsResult.error ??
    sendsResult.error ??
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

  const sends = (sendsResult.data ?? []) as DraftRow[];
  const data: FailedSend[] = sends.map((send) => {
    const customer_wa_id = customerByConversation.get(send.conversation_id) ?? send.customer_wa_id ?? "";
    const last_inbound_at = lastInboundByConversation.get(send.conversation_id) ?? null;
    const windowOpen = outboundReady && isWithinServiceWindow(last_inbound_at, now);
    return {
      id: send.id,
      conversation_id: send.conversation_id,
      customer_wa_id,
      body: send.body,
      message_type: send.message_type,
      wa_message_id: send.wa_message_id,
      template_name: send.template_name,
      failure_reason: typeof send.failure_reason === "string" ? send.failure_reason : null,
      created_at: send.created_at,
      last_inbound_at,
      windowOpen,
      retryable: windowOpen && !send.template_name,
    };
  });

  return { data, error: null };
}