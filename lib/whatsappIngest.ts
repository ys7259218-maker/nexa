import type { SupabaseClient } from "@supabase/supabase-js";

import type { AIProvider } from "./ai/provider";
import type { WhatsAppInboundEvent } from "./whatsappEvents";

export interface IngestSummary {
  accepted: number;
  duplicates: number;
  skipped: number;
  failed: number;
}

export interface WebhookEventRow {
  id: string;
  event_id: string;
  event_kind: string;
  phone_number_id: string;
  from_wa_id: string;
  profile_name: string;
  message_type: string;
  message_body: string;
  occurred_at: string | null;
  status: "claimed" | "processed" | "skipped" | "failed";
  attempts: number;
  last_error: string;
  received_at: string;
  processed_at: string | null;
}

interface EmployeeContext {
  id: string | null;
  name: string;
  business_name: string;
  greeting_message: string;
  knowledge_notes: string;
}

const MAX_ERROR_LENGTH = 500;

export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_LENGTH);
}

function eventToLedgerRow(event: WhatsAppInboundEvent) {
  return {
    event_id: event.eventId,
    event_kind: "message",
    phone_number_id: event.phoneNumberId,
    from_wa_id: event.fromWaId,
    profile_name: event.profileName,
    message_type: event.messageType,
    message_body: event.body,
    occurred_at: event.occurredAtIso,
  };
}

function ledgerRowToEvent(row: WebhookEventRow): WhatsAppInboundEvent {
  return {
    eventId: row.event_id,
    phoneNumberId: row.phone_number_id,
    fromWaId: row.from_wa_id,
    profileName: row.profile_name,
    messageType: row.message_type === "text" ? "text" : "unsupported",
    body: row.message_body,
    occurredAtIso: row.occurred_at ?? new Date().toISOString(),
  };
}

async function claimWebhookEvent(
  supabase: SupabaseClient,
  event: WhatsAppInboundEvent,
): Promise<{ claimed: boolean; rowId: string | null }> {
  const { data, error } = await supabase
    .from("webhook_events")
    .upsert(eventToLedgerRow(event), { onConflict: "event_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw new Error(`Claiming webhook event failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { claimed: false, rowId: null };
  }

  return { claimed: true, rowId: (data[0] as { id: string }).id };
}

async function resolveChannelOwner(
  supabase: SupabaseClient,
  phoneNumberId: string,
): Promise<string | null> {
  if (!phoneNumberId) return null;

  const { data, error } = await supabase
    .from("whatsapp_channels")
    .select("user_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (error) {
    throw new Error(`Resolving WhatsApp channel failed: ${error.message}`);
  }

  return data ? (data as { user_id: string }).user_id : null;
}

async function loadEmployeeContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<EmployeeContext> {
  const { data, error } = await supabase
    .from("ai_employees")
    .select("id, name, business_name, greeting_message, knowledge_notes, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`Loading AI employees for reply context failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    business_name: string;
    greeting_message: string;
    knowledge_notes: string;
    status: string;
  }>;

  const active = rows.find((row) => row.status === "Active") ?? rows[0];

  if (!active) {
    return { id: null, name: "", business_name: "", greeting_message: "", knowledge_notes: "" };
  }

  return {
    id: active.id,
    name: active.name,
    business_name: active.business_name,
    greeting_message: active.greeting_message,
    knowledge_notes: active.knowledge_notes,
  };
}

async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  aiEmployeeId: string | null,
  customerWaId: string,
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("customer_wa_id", customerWaId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Looking up conversation failed: ${selectError.message}`);
  }

  if (existing) {
    return (existing as { id: string }).id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("conversations")
    .insert({ user_id: userId, ai_employee_id: aiEmployeeId, customer_wa_id: customerWaId })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Creating conversation failed: ${insertError.message}`);
  }

  return (inserted as { id: string }).id;
}

async function storeInboundMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    userId: string;
    event: WhatsAppInboundEvent;
  },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      direction: "inbound",
      wa_message_id: input.event.eventId,
      message_type: input.event.messageType,
      body: input.event.body.slice(0, 4000),
      status: "received",
      sent_at: input.event.occurredAtIso,
    })
    .select("id");

  // A unique violation on wa_message_id means a previous attempt already stored
  // this exact message; treating it as success keeps retries idempotent.
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return false;
    }

    throw new Error(`Storing inbound message failed: ${error.message}`);
  }

  return Boolean(data && data.length > 0);
}

async function storeOutboundDraft(
  supabase: SupabaseClient,
  input: { conversationId: string; userId: string; reply: string },
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    user_id: input.userId,
    direction: "outbound",
    wa_message_id: null,
    message_type: "text",
    body: input.reply,
    status: "draft_blocked",
  });

  if (error) {
    throw new Error(`Storing outbound draft failed: ${error.message}`);
  }
}

async function markEventStatus(
  supabase: SupabaseClient,
  eventId: string,
  patch: Partial<Pick<WebhookEventRow, "status" | "attempts" | "last_error" | "processed_at">>,
): Promise<void> {
  const { error } = await supabase.from("webhook_events").update(patch).eq("event_id", eventId);

  if (error) {
    throw new Error(`Updating webhook event status failed: ${error.message}`);
  }
}

async function processMessageEvent(
  supabase: SupabaseClient,
  provider: AIProvider,
  eventId: string,
  event: WhatsAppInboundEvent,
  priorAttempts = 0,
): Promise<"processed" | "skipped" | "failed"> {
  try {
    const userId = await resolveChannelOwner(supabase, event.phoneNumberId);

    if (!userId) {
      await markEventStatus(supabase, eventId, {
        status: "skipped",
        last_error: "unknown_channel",
        processed_at: new Date().toISOString(),
      });
      return "skipped";
    }

    const employee = await loadEmployeeContext(supabase, userId);
    const conversationId = await getOrCreateConversation(
      supabase,
      userId,
      employee.id,
      event.fromWaId,
    );

    const stored = await storeInboundMessage(supabase, { conversationId, userId, event });

    if (!stored) {
      // A previous attempt already persisted this exact message id.
      await markEventStatus(supabase, eventId, {
        status: "processed",
        last_error: "duplicate_message_id",
        processed_at: new Date().toISOString(),
      });
      return "processed";
    }

    if (event.messageType === "text") {
      const reply = await provider.generateReply({
        businessName: employee.business_name,
        employeeName: employee.name,
        greetingMessage: employee.greeting_message,
        knowledgeNotes: employee.knowledge_notes,
        customerMessage: event.body,
      });

      await storeOutboundDraft(supabase, { conversationId, userId, reply });
    }

    await markEventStatus(supabase, eventId, {
      status: "processed",
      processed_at: new Date().toISOString(),
    });

    return "processed";
  } catch (error) {
    try {
      await markEventStatus(supabase, eventId, {
        status: "failed",
        attempts: priorAttempts + 1,
        last_error: sanitizeError(error),
      });
    } catch {
      // The ledger itself is unavailable; nothing durable to record. The caller
      // still counts this attempt as failed.
    }

    return "failed";
  }
}

export async function processWhatsAppEvents(
  supabase: SupabaseClient,
  provider: AIProvider,
  events: WhatsAppInboundEvent[],
): Promise<IngestSummary> {
  const summary: IngestSummary = { accepted: 0, duplicates: 0, skipped: 0, failed: 0 };

  for (const event of events) {
    let claim: { claimed: boolean; rowId: string | null };

    try {
      claim = await claimWebhookEvent(supabase, event);
    } catch (error) {
      console.error(`Webhook claim failed for event ${sanitizeError(error)}`);
      summary.failed += 1;
      continue;
    }

    if (!claim.claimed || !claim.rowId) {
      summary.duplicates += 1;
      continue;
    }

    const outcome = await processMessageEvent(supabase, provider, event.eventId, event);

    if (outcome === "processed") summary.accepted += 1;
    else if (outcome === "skipped") summary.skipped += 1;
    else summary.failed += 1;
  }

  return summary;
}

export async function retryFailedWebhookEvents(
  supabase: SupabaseClient,
  provider: AIProvider,
  limit = 10,
): Promise<IngestSummary> {
  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("status", "failed")
    .order("received_at", { ascending: true })
    .limit(limit);

  const summary: IngestSummary = { accepted: 0, duplicates: 0, skipped: 0, failed: 0 };

  if (error) {
    throw new Error(`Loading failed webhook events failed: ${error.message}`);
  }

  const rows = (data ?? []) as WebhookEventRow[];

  for (const row of rows) {
    const outcome = await processMessageEvent(
      supabase,
      provider,
      row.event_id,
      ledgerRowToEvent(row),
      row.attempts,
    );

    if (outcome === "processed") summary.accepted += 1;
    else if (outcome === "skipped") summary.skipped += 1;
    else summary.failed += 1;
  }

  return summary;
}
