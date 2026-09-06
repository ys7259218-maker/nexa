import type { SupabaseClient } from "@supabase/supabase-js";

import { isValidE164 } from "../outbound/validation.ts";
import { isWithinServiceWindow, validateTemplate } from "../outbound/sessionWindow.ts";
import {
  parseOutboundConfig,
  sendTemplateMessage,
  sendTextMessage,
  type SendOutcome,
} from "../outbound/whatsappSender.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidDraftMessageId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 36 && UUID_PATTERN.test(value);
}

export function isValidTemplateName(value: unknown): value is string {
  return typeof value === "string" && value.length <= 512;
}

export function isValidTemplateLanguage(value: unknown): value is string {
  return typeof value === "string" && value.length <= 20;
}

export function isValidTemplateParams(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > 10) return false;
  return value.every((entry) => typeof entry === "string" && entry.length <= 500);
}

export type ApproveDraftFailure =
  | "not_found"
  | "not_draft"
  | "not_allowed"
  | "not_ready"
  | "invalid_recipient"
  | "invalid_template"
  | "window_unverified"
  | "send_failed"
  | "persist_failed";

export type ApproveDraftOutcome =
  | { ok: true; wamid: string | null }
  | { ok: false; code: ApproveDraftFailure; message: string };

export type SendApprovedDraftOptions = {
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
  send?: (to: string, body: string) => Promise<SendOutcome>;
  sendTemplate?: (
    to: string,
    name: string,
    language: string,
    componentParams?: string[],
  ) => Promise<SendOutcome>;
};

export function describeSendFailure(outcome: SendOutcome): string {
  switch (outcome.kind) {
    case "not_ready":
      return "WhatsApp outbound is not ready in this deployment.";
    case "invalid":
      return `WhatsApp rejected the message: ${outcome.reason}.`;
    case "rate_limited":
      return "WhatsApp rate limit encountered; try again shortly.";
    case "error":
      return "WhatsApp did not accept the message. No message was sent.";
    case "sent":
      return "Message was sent.";
  }
}

async function loadDraft(
  service: SupabaseClient,
  sessionUserId: string,
  messageId: string,
): Promise<
  | { ok: true; message: Record<string, unknown>; conversation: Record<string, unknown> }
  | { ok: false; code: "not_found" | "not_draft"; message: string }
> {
  const messageResult = await service
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  const message = messageResult.error ? null : (messageResult.data as Record<string, unknown> | null);
  if (!message || message.user_id !== sessionUserId) {
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

  return { ok: true, message, conversation };
}

export async function sendApprovedDraft(
  service: SupabaseClient,
  sessionUserId: string,
  messageId: string,
  options: SendApprovedDraftOptions = {},
): Promise<ApproveDraftOutcome> {
  const templateName = isValidTemplateName(options.templateName ?? null)
    ? options.templateName
    : undefined;
  const templateLanguage = isValidTemplateLanguage(options.templateLanguage ?? null)
    ? options.templateLanguage
    : undefined;
  if (options.templateParams !== undefined && !isValidTemplateParams(options.templateParams)) {
    return {
      ok: false,
      code: "invalid_template",
      message: "The template reference is invalid: template_params_bad_shape.",
    };
  }
  const templateParams = options.templateParams;

  const send =
    options.send ??
    (async (to: string, body: string) => {
      const config = parseOutboundConfig();
      return sendTextMessage({ config, to, body });
    });
  const sendTemplate =
    options.sendTemplate ??
    (async (to: string, name: string, language: string, componentParams?: string[]) => {
      const config = parseOutboundConfig();
      return sendTemplateMessage({ config, to, name, language, componentParams });
    });

  const loaded = await loadDraft(service, sessionUserId, messageId);
  if (!loaded.ok) return loaded;

  const { message, conversation } = loaded;

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

  const lastInboundResult = await service
    .from("messages")
    .select("created_at")
    .eq("conversation_id", message.conversation_id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastInboundResult.error) {
    return {
      ok: false,
      code: "window_unverified",
      message: "The customer-service window could not be verified, so the draft was not sent.",
    };
  }
  const lastInboundAt =
    (lastInboundResult.data as { created_at?: string } | null)?.created_at ?? null;
  const windowClosed = !isWithinServiceWindow(lastInboundAt);

  let expectedTemplateName: string | null = null;
  let sendOutcome: SendOutcome;

  if (windowClosed) {
    if (!templateName) {
      return {
        ok: false,
        code: "not_allowed",
        message:
          "The 24-hour customer-service window has closed. Free-form replies are not allowed outside it; approve with a pre-approved template to send.",
      };
    }
    const templateValidation = validateTemplate({
      name: templateName,
      language: templateLanguage ?? "en",
      componentParams: templateParams,
    });
    if (!templateValidation.valid) {
      return {
        ok: false,
        code: "invalid_template",
        message: `The template reference is invalid: ${templateValidation.reason}.`,
      };
    }
    expectedTemplateName = templateName;
    sendOutcome = await sendTemplate(
      recipient,
      templateName,
      templateLanguage ?? "en",
      templateParams,
    );
  } else {
    const body = typeof message.body === "string" ? message.body : "";
    sendOutcome = await send(recipient, body);
  }

  if (sendOutcome.kind !== "sent") {
    return { ok: false, code: "send_failed", message: describeSendFailure(sendOutcome) };
  }

  const updateResult = await service
    .from("messages")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      wa_message_id: sendOutcome.wamid,
      ...(expectedTemplateName === null ? {} : { template_name: expectedTemplateName }),
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