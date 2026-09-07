import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatStatusFailureReason,
  parseWhatsAppWebhookPayload,
  type WhatsAppInboundEvent,
  type WhatsAppStatusEvent,
} from "./whatsappEvents.ts";

function textMessageEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550001111", phone_number_id: "phone-123" },
              contacts: [{ profile: { name: "Test Customer" }, wa_id: "15557771234" }],
              messages: [
                {
                  from: "15557771234",
                  id: "wamid.abc123",
                  timestamp: "1700000000",
                  text: { body: "Hello, do you have appointments on Friday?" },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

test("parseWhatsAppWebhookPayload extracts a text message event", () => {
  const events = parseWhatsAppWebhookPayload(textMessageEnvelope());

  assert.equal(events.length, 1);

  const event = events[0] as WhatsAppInboundEvent;
  assert.equal(event.eventId, "wamid.abc123");
  assert.equal(event.phoneNumberId, "phone-123");
  assert.equal(event.fromWaId, "15557771234");
  assert.equal(event.profileName, "Test Customer");
  assert.equal(event.messageType, "text");
  assert.equal(event.body, "Hello, do you have appointments on Friday?");
  assert.equal(new Date(event.occurredAtIso).getTime(), 1700000000 * 1000);
});

test("parseWhatsAppWebhookPayload extracts multiple messages across entries", () => {
  const payload = textMessageEnvelope();
  const value = (payload.entry as Array<{ changes: Array<{ value: Record<string, unknown> }> }>)[0]
    .changes[0].value;

  value.messages = [
    { from: "15557771234", id: "wamid.one", timestamp: "1700000000", type: "text", text: { body: "first" } },
    { from: "15557771234", id: "wamid.two", timestamp: "1700000001", type: "text", text: { body: "second" } },
  ];

  const events = parseWhatsAppWebhookPayload(payload) as WhatsAppInboundEvent[];

  assert.deepEqual(
    events.map((event) => event.eventId),
    ["wamid.one", "wamid.two"],
  );
});

test("parseWhatsAppWebhookPayload keeps unsupported message types for deduplication", () => {
  const payload = textMessageEnvelope();
  const value = (payload.entry as Array<{ changes: Array<{ value: Record<string, unknown> }> }>)[0]
    .changes[0].value;

  value.messages = [
    { from: "15557771234", id: "wamid.image", timestamp: "1700000002", type: "image" },
  ];

  const events = parseWhatsAppWebhookPayload(payload) as WhatsAppInboundEvent[];

  assert.equal(events.length, 1);
  assert.equal(events[0]?.messageType, "unsupported");
  assert.equal(events[0]?.body, "");
});

test("parseWhatsAppWebhookPayload extracts supported status receipts", () => {
  const statusOnly = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-123" },
              statuses: [{ id: "wamid.abc123", recipient_id: "15557771234", status: "delivered", timestamp: "1700000005" }],
            },
          },
        ],
      },
    ],
  };

  assert.deepEqual(parseWhatsAppWebhookPayload(statusOnly), [{
    eventKind: "status",
    eventId: "status:wamid.abc123:delivered",
    phoneNumberId: "phone-123",
    recipientWaId: "15557771234",
    messageId: "wamid.abc123",
    status: "delivered",
    errors: [],
    occurredAtIso: new Date(1700000005 * 1000).toISOString(),
  }]);
});

test("parseWhatsAppWebhookPayload extracts a bounded failure reason from a failed receipt", () => {
  const failed = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-123" },
              statuses: [{
                id: "wamid.rejected",
                recipient_id: "15557771234",
                status: "failed",
                timestamp: "1700000006",
                errors: [
                  {
                    code: 131026,
                    title: "Message undeliverable",
                    message: "Message failed to send because more than 24 hours have passed since the customer last replied.",
                    error_data: { details: "Re-engagement conversation" },
                  },
                ],
              }],
            },
          },
        ],
      },
    ],
  };

  const [event] = parseWhatsAppWebhookPayload(failed) as WhatsAppStatusEvent[];
  assert.equal(event?.status, "failed");
  assert.deepEqual(event?.errors, [{
    code: 131026,
    title: "Message undeliverable",
    message: "Message failed to send because more than 24 hours have passed since the customer last replied.",
    details: "Re-engagement conversation",
  }]);
  assert.equal(formatStatusFailureReason(event?.errors), "Re-engagement conversation");
});

test("parseWhatsAppWebhookPayload bounds and skips malformed status errors", () => {
  const failed = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-123" },
              statuses: [{
                id: "wamid.rejected-2",
                recipient_id: "15557771234",
                status: "failed",
                timestamp: "1700000007",
                errors: [
                  { title: "ignored non-object" },
                  { title: "x".repeat(900), error_data: { details: "d".repeat(900) }, code: "not-a-number" },
                  { title: "third" },
                  { title: "fourth-over-cap" },
                ],
              }],
            },
          },
        ],
      },
    ],
  };

  const [event] = parseWhatsAppWebhookPayload(failed) as WhatsAppStatusEvent[];
  assert.equal(event?.errors?.length, 3, "invalid and over-cap entries are bounded");
  assert.equal(event?.errors?.[0]?.code, null);
  assert.equal(event?.errors?.[1]?.title.length, 400);
  assert.equal(event?.errors?.[1]?.details.length, 400);
  assert.equal(event?.errors?.[2]?.title, "third");
  assert.ok(!event?.errors?.some((error) => error.title === "fourth-over-cap"));
});

test("formatStatusFailureReason falls back detail -> message -> title and handles absence", () => {
  assert.equal(
    formatStatusFailureReason([
      { code: null, title: "A title", message: "A message", details: "The details" },
    ]),
    "The details",
  );
  assert.equal(
    formatStatusFailureReason([
      { code: 1, title: "A title", message: "A message", details: "" },
    ]),
    "A message",
  );
  assert.equal(
    formatStatusFailureReason([
      { code: 2, title: "A title", message: "", details: "" },
    ]),
    "A title",
  );
  assert.equal(formatStatusFailureReason(undefined), null);
  assert.equal(formatStatusFailureReason([]), null);
});

test("parseWhatsAppWebhookPayload ignores unsupported receipts and malformed payloads", () => {
  const sentOnly = {
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: "phone-123" },
      statuses: [{ id: "wamid.abc123", status: "sent" }],
    } }] }],
  };

  assert.deepEqual(parseWhatsAppWebhookPayload(sentOnly), []);
  assert.deepEqual(parseWhatsAppWebhookPayload(null), []);
  assert.deepEqual(parseWhatsAppWebhookPayload("nope"), []);
  assert.deepEqual(parseWhatsAppWebhookPayload({ entry: "not-an-array" }), []);
  assert.deepEqual(parseWhatsAppWebhookPayload(textMessageEnvelope({ entry: [{}] })), []);

  const missingMessageId = textMessageEnvelope();
  (
    missingMessageId.entry as Array<{ changes: Array<{ value: { messages: unknown[] } }> }>
  )[0].changes[0].value.messages = [{ from: "15557771234", type: "text" }];

  assert.deepEqual(parseWhatsAppWebhookPayload(missingMessageId), []);
});

test("parseWhatsAppWebhookPayload falls back to now for invalid timestamps", () => {
  const payload = textMessageEnvelope();
  const value = (payload.entry as Array<{ changes: Array<{ value: Record<string, unknown> }> }>)[0]
    .changes[0].value;

  value.messages = [
    { from: "15557771234", id: "wamid.badts", timestamp: "not-a-number", type: "text", text: { body: "hi" } },
  ];

  const before = Date.now();
  const event = parseWhatsAppWebhookPayload(payload)[0];
  const after = Date.now();

  const parsed = new Date(event?.occurredAtIso ?? "").getTime();
  assert.ok(parsed >= before - 1000 && parsed <= after + 1000);
});

