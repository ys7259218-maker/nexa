import type { SupabaseClient } from "@supabase/supabase-js";

import type { AIProvider } from "./ai/provider";
import type {
  WhatsAppInboundEvent,
  WhatsAppStatusEvent,
  WhatsAppWebhookEvent,
} from "./whatsappEvents";
import { isWhatsAppStatusEvent } from "./whatsappEvents.ts";
import {
  findVerifiedFaqAnswer,
  formatVerifiedKnowledge,
  type KnowledgeEntry,
} from "./knowledgeEntries.ts";

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
  knowledge_entries: KnowledgeEntry[];
}

const MAX_ERROR_LENGTH = 500;

type WebhookLedgerInsert = {
  event_id: string;
  event_kind: string;
  phone_number_id: string;
  from_wa_id: string;
  profile_name: string;
  message_type: string;
  message_body: string;
  occurred_at: string;
};

export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_LENGTH);
}

function eventToLedgerRow(event: WhatsAppWebhookEvent): WebhookLedgerInsert {
  if (isWhatsAppStatusEvent(event)) {
    return {
      event_id: event.eventId,
      event_kind: "status",
      phone_number_id: event.phoneNumberId,
      from_wa_id: event.recipientWaId,
      profile_name: "",
      message_type: event.status,
      message_body: event.messageId,
      occurred_at: event.occurredAtIso,
    };
  }

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

function ledgerRowToEvent(row: WebhookEventRow): WhatsAppWebhookEvent {
  if (row.event_kind === "status") {
    return {
      eventKind: "status",
      eventId: row.event_id,
      phoneNumberId: row.phone_number_id,
      recipientWaId: row.from_wa_id,
      messageId: row.message_body,
      status: row.message_type as WhatsAppStatusEvent["status"],
      occurredAtIso: row.occurred_at ?? new Date().toISOString(),
    };
  }

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
  event: WhatsAppWebhookEvent,
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

const DELIVERY_STATUS_RANK: Record<WhatsAppStatusEvent["status"], number> = {
  failed: 1,
  delivered: 2,
  read: 3,
};

export function shouldApplyDeliveryStatus(
  currentStatus: string,
  incomingStatus: WhatsAppStatusEvent["status"],
): boolean {
  const currentRank = DELIVERY_STATUS_RANK[currentStatus as WhatsAppStatusEvent["status"]] ?? 0;
  return DELIVERY_STATUS_RANK[incomingStatus] > currentRank;
}

async function processStatusEvent(
  supabase: SupabaseClient,
  event: WhatsAppStatusEvent,
  priorAttempts = 0,
): Promise<"processed" | "skipped" | "failed"> {
  try {
    const owner = await resolveChannelOwner(supabase, event.phoneNumberId);

    if (!owner) {
      await markEventStatus(supabase, event.eventId, {
        status: "skipped",
        last_error: "unknown_channel",
        processed_at: new Date().toISOString(),
      });
      return "skipped";
    }

    const { data: message, error } = await supabase
      .from("messages")
      .select("id,status")
      .eq("workspace_id", owner.workspaceId)
      .eq("wa_message_id", event.messageId)
      .eq("direction", "outbound")
      .maybeSingle();

    if (error) {
      throw new Error(`Loading outbound message for status failed: ${error.message}`);
    }

    if (!message) {
      await markEventStatus(supabase, event.eventId, {
        status: "skipped",
        last_error: "unknown_message",
        processed_at: new Date().toISOString(),
      });
      return "skipped";
    }

    const stored = message as { id: string; status: string };

    if (shouldApplyDeliveryStatus(stored.status, event.status)) {
      const { error: updateError } = await supabase
        .from("messages")
        .update({ status: event.status })
        .eq("id", stored.id)
        .eq("workspace_id", owner.workspaceId);

      if (updateError) {
        throw new Error(`Updating outbound message status failed: ${updateError.message}`);
      }
    }

    await markEventStatus(supabase, event.eventId, {
      status: "processed",
      processed_at: new Date().toISOString(),
    });
    return "processed";
  } catch (error) {
    try {
      await markEventStatus(supabase, event.eventId, {
        status: "failed",
        attempts: priorAttempts + 1,
        last_error: sanitizeError(error),
      });
    } catch {
      // The caller still records the failed aggregate when the ledger is unavailable.
    }

    return "failed";
  }
}

async function resolveChannelOwner(
  supabase: SupabaseClient,
  phoneNumberId: string,
): Promise<{
  userId: string;
  workspaceId: string;
  aiEmployeeId: string | null;
  assignmentAuthoritative: boolean;
} | null> {
  if (!phoneNumberId) return null;

  const assignmentEnabled = process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED === "true";
  const columns = assignmentEnabled
    ? "user_id,workspace_id,ai_employee_id"
    : "user_id,workspace_id";

  const { data, error } = await supabase
    .from("whatsapp_channels")
    .select(columns)
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (error) {
    throw new Error(`Resolving WhatsApp channel failed: ${error.message}`);
  }

  if (!data) return null;
  const channel = data as unknown as {
    user_id: string;
    workspace_id: string;
    ai_employee_id?: string | null;
  };
  return {
    userId: channel.user_id,
    workspaceId: channel.workspace_id,
    aiEmployeeId: assignmentEnabled ? channel.ai_employee_id ?? null : null,
    assignmentAuthoritative: assignmentEnabled,
  };
}

async function loadEmployeeContext(
  supabase: SupabaseClient,
  workspaceId: string,
  aiEmployeeId: string | null,
): Promise<EmployeeContext> {
  if (!aiEmployeeId) {
    return { id: null, name: "", business_name: "", greeting_message: "", knowledge_notes: "", knowledge_entries: [] };
  }

  const { data, error } = await supabase
    .from("ai_employees")
    .select(
      "id, name, business_name, greeting_message, knowledge_notes, lifecycle_status, automation_paused",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", aiEmployeeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Loading AI employees for reply context failed: ${error.message}`);
  }

  const employee = data as {
    id: string;
    name: string;
    business_name: string;
    greeting_message: string;
    knowledge_notes: string;
    lifecycle_status: string;
    automation_paused: boolean;
  } | null;

  if (
    !employee ||
    employee.lifecycle_status !== "Active" ||
    employee.automation_paused !== false
  ) {
    return { id: null, name: "", business_name: "", greeting_message: "", knowledge_notes: "", knowledge_entries: [] };
  }

  let knowledgeEntries: KnowledgeEntry[] = [];
  const structuredKnowledgeEnabled = process.env.KNOWLEDGE_V0_ENABLED === "true";
  if (structuredKnowledgeEnabled) {
    const { data: knowledgeData, error: knowledgeError } = await supabase
      .from("knowledge_entries")
      .select("id,workspace_id,ai_employee_id,kind,title,question,content,verified,created_by,updated_by,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("ai_employee_id", employee.id)
      .eq("verified", true)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (knowledgeError) {
      throw new Error(`Loading verified knowledge for reply context failed: ${knowledgeError.message}`);
    }
    knowledgeEntries = (knowledgeData ?? []) as KnowledgeEntry[];
  }

  return {
    id: employee.id,
    name: employee.name,
    business_name: employee.business_name,
    greeting_message: employee.greeting_message,
    knowledge_notes: structuredKnowledgeEnabled ? "" : employee.knowledge_notes,
    knowledge_entries: knowledgeEntries,
  };
}

async function isWorkspaceAutomationPaused(supabase: SupabaseClient, workspaceId: string): Promise<boolean> {
  if (process.env.WORKSPACE_SAFETY_ENABLED !== "true") return true;
  const { data, error } = await supabase.from("workspaces").select("automation_paused").eq("id", workspaceId).maybeSingle();
  if (error || !data) throw new Error("Loading workspace safety state failed");
  return (data as { automation_paused?: boolean }).automation_paused !== false;
}

async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  aiEmployeeId: string | null,
  customerWaId: string,
  assignmentAuthoritative: boolean,
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("conversations")
    .select("id,ai_employee_id")
    .eq("workspace_id", workspaceId)
    .eq("customer_wa_id", customerWaId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Looking up conversation failed: ${selectError.message}`);
  }

  if (existing) {
    const conversation = existing as { id: string; ai_employee_id: string | null };
    if (
      assignmentAuthoritative &&
      conversation.ai_employee_id !== aiEmployeeId
    ) {
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ ai_employee_id: aiEmployeeId })
        .eq("workspace_id", workspaceId)
        .eq("id", conversation.id);

      if (updateError) {
        throw new Error(`Synchronizing conversation assignment failed: ${updateError.message}`);
      }
    }
    return conversation.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("conversations")
    .insert({ user_id: userId, workspace_id: workspaceId, ai_employee_id: aiEmployeeId, customer_wa_id: customerWaId })
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
    workspaceId: string;
    event: WhatsAppInboundEvent;
  },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      workspace_id: input.workspaceId,
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
  input: { conversationId: string; userId: string; workspaceId: string; reply: string },
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    user_id: input.userId,
    workspace_id: input.workspaceId,
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
    const owner = await resolveChannelOwner(supabase, event.phoneNumberId);

    if (!owner) {
      await markEventStatus(supabase, eventId, {
        status: "skipped",
        last_error: "unknown_channel",
        processed_at: new Date().toISOString(),
      });
      return "skipped";
    }

    const employee = await loadEmployeeContext(
      supabase,
      owner.workspaceId,
      owner.aiEmployeeId,
    );
    const conversationId = await getOrCreateConversation(
      supabase,
      owner.userId,
      owner.workspaceId,
      employee.id,
      event.fromWaId,
      owner.assignmentAuthoritative,
    );

    const stored = await storeInboundMessage(supabase, {
      conversationId,
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      event,
    });

    if (!stored) {
      // A previous attempt already persisted this exact message id.
      await markEventStatus(supabase, eventId, {
        status: "processed",
        last_error: "duplicate_message_id",
        processed_at: new Date().toISOString(),
      });
      return "processed";
    }

    const workspacePaused = await isWorkspaceAutomationPaused(supabase, owner.workspaceId);

    if (event.messageType === "text" && !workspacePaused && employee.id !== null) {
      const verifiedAnswer = findVerifiedFaqAnswer(employee.knowledge_entries, event.body);
      const structuredKnowledge = formatVerifiedKnowledge(employee.knowledge_entries);
      const knowledgeNotes = [employee.knowledge_notes, structuredKnowledge]
        .filter(Boolean)
        .join("\n")
        .slice(0, 4_000);
      const reply = verifiedAnswer ?? await provider.generateReply({
        businessName: employee.business_name,
        employeeName: employee.name,
        greetingMessage: employee.greeting_message,
        knowledgeNotes,
        customerMessage: event.body,
      });

      await storeOutboundDraft(supabase, {
        conversationId,
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        reply,
      });
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
  events: WhatsAppWebhookEvent[],
): Promise<IngestSummary> {
  const summary: IngestSummary = { accepted: 0, duplicates: 0, skipped: 0, failed: 0 };

  for (const event of events) {
    let claim: { claimed: boolean; rowId: string | null };

    try {
      claim = await claimWebhookEvent(supabase, event);
    } catch {
      // Do not log the event id or database error: either can contain customer
      // or infrastructure details. The aggregate response records the failure.
      console.error("Webhook event claim failed.");
      summary.failed += 1;
      continue;
    }

    if (!claim.claimed || !claim.rowId) {
      summary.duplicates += 1;
      continue;
    }

    const outcome = isWhatsAppStatusEvent(event)
      ? await processStatusEvent(supabase, event)
      : await processMessageEvent(supabase, provider, event.eventId, event);

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
    const event = ledgerRowToEvent(row);
    const outcome = isWhatsAppStatusEvent(event)
      ? await processStatusEvent(supabase, event, row.attempts)
      : await processMessageEvent(supabase, provider, row.event_id, event, row.attempts);

    if (outcome === "processed") summary.accepted += 1;
    else if (outcome === "skipped") summary.skipped += 1;
    else summary.failed += 1;
  }

  return summary;
}
