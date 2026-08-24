# WhatsApp Cloud API status

## External blocker

The Meta WhatsApp phone number is Pending/not fully registered. This is an external account/registration state, not a code or build failure. It does not block UI, database, AI runtime, or webhook development. Production sending must stay disabled until Meta marks the number ready and a real phone-number ID/token can be tested.

## Inbound pipeline (implemented)

`POST /api/whatsapp/webhook` now runs a durable, idempotent pipeline:

1. `x-hub-signature-256` is verified against server-only `WHATSAPP_APP_SECRET`; anything else gets 401.
2. Valid bodies are handed to the server-only processor boundary (`lib/server/whatsappProcessor.ts`). Responses always return 200 with an aggregate summary so Meta never retry-storms; failures are recorded on the ledger instead.
3. Each message event is claimed in `webhook_events` using Meta's immutable message id (`ON CONFLICT DO NOTHING`). Replayed webhooks are counted as duplicates and dropped. A unique index on `messages.wa_message_id` is the second safety layer, so interrupted processing resumes without double-storing history.
4. Claimed events resolve their owner through `whatsapp_channels.phone_number_id`, get-or-create a `(user_id, customer_wa_id)` conversation, store the inbound message, and generate a reply through the AI provider interface (`lib/ai/provider.ts`).
5. Outbound replies are stored as messages with status `draft_blocked`. They are never sent: outbound sending stays disabled behind `WHATSAPP_OUTBOUND_ENABLED=false` until Meta registration clears.
6. Failed events increment `attempts`, keep a sanitized `last_error`, and are replayable via `retryFailedWebhookEvents` (ledger rows keep minimal normalized fields — no raw envelopes — and should be purged after 7 days; see `docs/SUPABASE_SETUP.md`).

Unsupported media types are stored for deduplication/history but produce no mock reply. Delivery receipts are acknowledged (200) but intentionally not tracked while outbound sending is disabled.

## AI provider

- Interface: `lib/ai/provider.ts`; selection reads `AI_PROVIDER` (default `mock`).
- Implemented providers: deterministic offline `MockAIProvider` and optional `OpenAIProvider` using the Responses API with `store: false`. Selection happens only in `lib/server/aiProvider.ts`; `OPENAI_API_KEY` and `OPENAI_MODEL` stay server-only. Missing/unknown configuration safely falls back to mock without logging secrets.
- Real providers must implement the same interface inside a server-only module before being registered.

## Status UI

The WhatsApp Setup card on `/ai-employees/[id]` shows live server-derived status:

- Webhook configured — `WHATSAPP_VERIFY_TOKEN` + `WHATSAPP_APP_SECRET` present
- Inbound processing ready — `SUPABASE_SERVICE_ROLE_KEY` present
- Outbound sending blocked by Meta — always shown pending registration; replies accumulate as drafts only

The same card links a channel by saving its Meta Phone Number ID into `whatsapp_channels` through the owner's RLS-scoped session.

## Privacy rules (enforced in code review)

Never log or persist to non-database destinations: message bodies, access tokens, app secrets, webhook signatures, raw payloads, or end-customer phone numbers. Customer WhatsApp ids exist only inside RLS-protected tables; ledger errors carry sanitized exception messages only.

## Configuration

Server-only variables (never prefix with `NEXT_PUBLIC_`): `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` (future outbound), plus `SUPABASE_SERVICE_ROLE_KEY` for the processor. Configure Meta's callback URL as `https://YOUR_HOST/api/whatsapp/webhook`.

## Work that remains

After Meta registration: implement real outbound sending behind the feature flag, wire delivery receipts into message statuses, replace the mock with a real provider, and run a controlled end-to-end test with one known-good number.
