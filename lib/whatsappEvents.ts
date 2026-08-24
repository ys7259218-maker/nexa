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

export interface WhatsAppStatusEvent {
  eventKind: "status";
  eventId: string;
  phoneNumberId: string;
  recipientWaId: string;
  messageId: string;
  status: WhatsAppDeliveryStatus;
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
