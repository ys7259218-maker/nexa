# WhatsApp Cloud API status

## External blocker

The Meta WhatsApp phone number is Pending/not fully registered. This is an external account/registration state, not a code or build failure. It does not block UI, database, AI runtime, or webhook development. Production sending must stay disabled until Meta marks the number ready and a real phone-number ID/token can be tested.

## Webhook preparation

The endpoint is `/api/whatsapp/webhook`.

- `GET` performs Meta's challenge using server-only `WHATSAPP_VERIFY_TOKEN`.
- `POST` verifies `x-hub-signature-256` against server-only `WHATSAPP_APP_SECRET`.
- Valid events are acknowledged quickly; no payload is logged or persisted yet.
- `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are reserved for the future outbound server client.

Configure Meta's callback URL as `https://YOUR_HOST/api/whatsapp/webhook`. Never put Meta secrets in `NEXT_PUBLIC_*` variables.

## Work that can continue now

Design normalized conversation/message tables, add idempotency using Meta message IDs, enqueue event processing, connect an AI provider behind a server-only adapter, and build sandbox fixtures. After registration clears, add outbound sending and a controlled end-to-end test.
