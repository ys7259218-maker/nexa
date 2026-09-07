export interface WhatsAppInboundEvent {
  eventId: string;
  phoneNumberId: string;
  fromWaId: string;
  profileName: string;
  messageType: "text" | "unsupported";
  body: string;
  occurredAtIso: string;
}

export type WhatsAppDeliveryStatus = "delivered" | "read" | "failed";

export interface WhatsAppStatusError {
  code: number | null;
  title: string;
  message: string;
  details: string;
}

export interface WhatsAppStatusEvent {
  eventKind: "status";
  eventId: string;
  phoneNumberId: string;
  recipientWaId: string;
  messageId: string;
  status: WhatsAppDeliveryStatus;
  /** Meta error details attached to failed receipts; absent for delivered/read. */
  errors?: WhatsAppStatusError[];
  occurredAtIso: string;
}

export type WhatsAppWebhookEvent = WhatsAppInboundEvent | WhatsAppStatusEvent;

export function isWhatsAppStatusEvent(
  event: WhatsAppWebhookEvent,
): event is WhatsAppStatusEvent {
  return "eventKind" in event && event.eventKind === "status";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIsoTimestamp(value: unknown): string {
  const seconds = Number(asString(value));

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date().toISOString();
  }

  return new Date(seconds * 1000).toISOString();
}

const MAX_STATUS_ERROR_COUNT = 3;
const MAX_STATUS_ERROR_FIELD_LENGTH = 400;

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedText(value: unknown): string {
  return asString(value).slice(0, MAX_STATUS_ERROR_FIELD_LENGTH);
}

function parseStatusErrors(record: { errors?: unknown }): WhatsAppStatusError[] {
  if (!Array.isArray(record.errors)) return [];

  const errors: WhatsAppStatusError[] = [];
  for (const entry of record.errors) {
    if (errors.length >= MAX_STATUS_ERROR_COUNT) break;
    if (typeof entry !== "object" || entry === null) continue;

    const raw = entry as { code?: unknown; title?: unknown; message?: unknown; error_data?: unknown };
    const errorData = raw.error_data;
    errors.push({
      code: asNumber(raw.code),
      title: boundedText(raw.title),
      message: boundedText(raw.message),
      details:
        typeof errorData === "object" && errorData !== null
          ? boundedText((errorData as { details?: unknown }).details)
          : "",
    });
  }

  return errors;
}

/**
 * Picks the most human-readable rejection reason from Meta's status errors:
 * prefer the transport's detail text, then the message, then the title.
 * Null when the receipt carried no errors.
 */
export function formatStatusFailureReason(
  errors: WhatsAppStatusError[] | undefined,
): string | null {
  for (const error of errors ?? []) {
    const reason = error.details || error.message || error.title;
    if (reason) return reason;
  }
  return null;
}

export function parseWhatsAppWebhookPayload(payload: unknown): WhatsAppWebhookEvent[] {
  if (typeof payload !== "object" || payload === null) return [];

  const root = payload as { entry?: unknown };
  if (!Array.isArray(root.entry)) return [];

  const events: WhatsAppWebhookEvent[] = [];

  for (const entry of root.entry) {
    if (typeof entry !== "object" || entry === null) continue;

    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (typeof change !== "object" || change === null) continue;

      const value = (change as { value?: unknown }).value;
      if (typeof value !== "object" || value === null) continue;

      const metadata = (value as { metadata?: unknown }).metadata;
      const phoneNumberId =
        typeof metadata === "object" && metadata !== null
          ? asString((metadata as { phone_number_id?: unknown }).phone_number_id)
          : "";

      const statuses = (value as { statuses?: unknown }).statuses;

      if (Array.isArray(statuses)) {
        for (const statusRecord of statuses) {
          if (typeof statusRecord !== "object" || statusRecord === null) continue;

          const record = statusRecord as {
            id?: unknown;
            recipient_id?: unknown;
            status?: unknown;
            timestamp?: unknown;
            errors?: unknown;
          };
          const messageId = asString(record.id);
          const status = asString(record.status);

          if (!messageId || !["delivered", "read", "failed"].includes(status)) continue;

          events.push({
            eventKind: "status",
            eventId: `status:${messageId}:${status}`,
            phoneNumberId,
            recipientWaId: asString(record.recipient_id),
            messageId,
            status: status as WhatsAppDeliveryStatus,
            errors: parseStatusErrors(record),
            occurredAtIso: toIsoTimestamp(record.timestamp),
          });
        }
      }

      const messages = (value as { messages?: unknown }).messages;
      if (!Array.isArray(messages)) continue;

      const contacts = (value as { contacts?: unknown }).contacts;
      let profileName = "";

      if (Array.isArray(contacts) && typeof contacts[0] === "object" && contacts[0] !== null) {
        const profile = (contacts[0] as { profile?: unknown }).profile;

        if (typeof profile === "object" && profile !== null) {
          profileName = asString((profile as { name?: unknown }).name);
        }
      }

      for (const message of messages) {
        if (typeof message !== "object" || message === null) continue;

        const record = message as {
          id?: unknown;
          from?: unknown;
          timestamp?: unknown;
          type?: unknown;
          text?: unknown;
        };

        const messageId = asString(record.id);
        if (!messageId) continue;

        const messageType = record.type === "text" ? "text" : "unsupported";
        const body =
          messageType === "text" && typeof record.text === "object" && record.text !== null
            ? asString((record.text as { body?: unknown }).body)
            : "";

        events.push({
          eventId: messageId,
          phoneNumberId,
          fromWaId: asString(record.from),
          profileName,
          messageType,
          body,
          occurredAtIso: toIsoTimestamp(record.timestamp),
        });
      }
    }
  }

  return events;
}
