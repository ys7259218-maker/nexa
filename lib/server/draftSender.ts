import type { SupabaseClient } from "@supabase/supabase-js";

import { isValidE164 } from "../outbound/validation.ts";
import {
  parseOutboundConfig,
  sendTextMessage,
  type SendOutcome,
} from "../outbound/whatsappSender.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidDraftMessageId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 36 && UUID_PATTERN.test(value);
}

export type ApproveDraftFailure =
  | "not_found"
  | "not_draft"
  | "not_allowed"
  | "not_ready"
  | "invalid_recipient"
  | "send_failed"
  | "persist_failed";

export type ApproveDraftOutcome =
  | { ok: true; wamid: string | null }
  | { ok: false; code: ApproveDraftFailure; message: string };

export type SendApprovedDraftOptions = {
  send?: (to: string, body: string) => Promise<SendOutcome>;
};

export function describeSendFailure(outcome: SendOutcome): string {
  switch (outcome.kind) {
    case "not_ready":
      return "WhatsApp outbound is not ready in this deployment.";
    case "invalid":
      return `WhatsApp rejected the draft: ${outcome.reason}.`;
    case "rate_limited":
      return "WhatsApp rate limit encountered; try again shortly.";
    case "error":
      return "WhatsApp did not accept the message. No message was sent.";
    case "sent":
      return "Message was sent.";
  }
}

export async function sendApprovedDraft(
  service: SupabaseClient,
  sessionUserId: string,
  messageId: string,
  options: SendApprovedDraftOptions = {},
): Promise<ApproveDraftOutcome> {
  const send =
    options.send ??
    (async (to: string, body: string) => {
      const config = parseOutboundConfig();
      return sendTextMessage({ config, to, body });
    });

  const messageResult = await service
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  const message = messageResult.error ? null : (messageResult.data as Record<string, unknown> | null);
  if (!message) {
    return { ok: false, code: "not_found", message: "Message not found." };
  }
  if (message.user_id !== sessionUserId) {
    return { ok: false, code: "not_found", message: "Message not found." };
  }
  if (message.direction !== "outbound" || message.status !== "draft_blocked") {
    return { ok: false, code: "not_draft", message: "This message is not a pending draft." };
  }

  const conversationResult = await service
    .from("conversations")
    .select("*")
    .eq("id", message.conversation_id)
    .maybeSingle();

  const conversation = conversationResult.error
    ? null
    : (conversationResult.data as Record<string, unknown> | null);
  if (!conversation || conversation.user_id !== sessionUserId) {
    return { ok: false, code: "not_found", message: "Conversation not found." };
  }

  if (conversation.customer_opted_out_at) {
    return {
      ok: false,
      code: "not_allowed",
      message: "This customer has opted out, so the draft was not sent.",
    };
  }
  if (conversation.automation_mode === "human" || conversation.human_takeover_at) {
    return {
      ok: false,
      code: "not_allowed",
      message: "Human takeover is active, so the draft was not sent.",
    };
  }

  const recipient = typeof conversation.customer_wa_id === "string" ? conversation.customer_wa_id : "";
  if (!isValidE164(recipient)) {
    return {
      ok: false,
      code: "invalid_recipient",
      message: "The stored contact number is not a valid E.164 number, so nothing was sent.",
    };
  }

  const body = typeof message.body === "string" ? message.body : "";
  const sendOutcome = await send(recipient, body);
  if (sendOutcome.kind !== "sent") {
    return { ok: false, code: "send_failed", message: describeSendFailure(sendOutcome) };
  }

  const updateResult = await service
    .from("messages")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      wa_message_id: sendOutcome.wamid,
    })
    .eq("id", messageId);

  if (updateResult.error) {
    return {
      ok: false,
      code: "persist_failed",
      message: "The draft was sent, but its delivery status could not be recorded here.",
    };
  }

  return { ok: true, wamid: sendOutcome.wamid };
}