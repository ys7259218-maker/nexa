# Outbound WhatsApp sender — transport/policy slice (v1)

## Status

**Wired into the approve-and-send runtime, still gated by `WHATSAPP_OUTBOUND_ENABLED`.**

The fail-closed Meta WhatsApp Cloud API outbound transport and policy layer lives
at `lib/outbound/whatsappSender.ts`. It is called by the approve-and-send path in
`lib/server/draftSender.ts` (`sendApprovedDraft`), so it **is** wired into a
runtime path. A real message can only be sent when:

- `WHATSAPP_OUTBOUND_ENABLED=true` **and** a non-empty `WHATSAPP_ACCESS_TOKEN`
  **and** a non-empty `WHATSAPP_PHONE_NUMBER_ID` are present (else the send
  outcome is `not_ready`), and
- an authenticated workspace owner/operator explicitly approves a specific
  pending draft.

## Session-window / template policy (lib/outbound/sessionWindow.ts)

A companion pure, deterministic policy module encodes Meta's delivery rules so
the transport never sends a legally-unavailable message:

- `resolveAllowedMessageKind(lastInboundAt, now)` →
  `{ kind: "freeform" | "template", withinWindow }`. Free-form is allowed only
  while the 24-hour customer service window is open (strictly inside 24h of the
  recipient's last inbound message); no inbound record, an older inbound, a
  future inbound, or an unparsable timestamp all force template mode.
- `isWithinServiceWindow(...)` — convenience boolean, used by
  `sendApprovedDraft` against real inbound history before any free-form send.
- `validateTemplate({ name, language, componentParams })` — bounds and validates
  a template reference (conservative `[A-Za-z0-9_]` name, bounded language and
  component params) so unbounded/malicious input is never forwarded.

## What it provides (transport)

- `parseOutboundConfig(env)` — reads env into a config that fails closed.
- `isOutboundSendReady(config)` — requires `WHATSAPP_OUTBOUND_ENABLED === "true"`
  **and** a non-empty `WHATSAPP_ACCESS_TOKEN` **and** a non-empty
  `WHATSAPP_PHONE_NUMBER_ID`. Missing any one of them → sending is disabled.
- `sendTextMessage(...)` — constructs the Meta Cloud API text payload
  (`POST https://graph.facebook.com/{version}/{phone-number-id}/messages`),
  sends it with `Authorization: Bearer`, and returns a typed outcome:
  `not_ready | invalid | rate_limited | sent{wamid} | error`.
- `buildTextPayload(...)` — bounds the body and builds the payload.
- `sendTemplateMessage(...)` — validated template send via
  `buildTemplatePayload` (components bounded by `validateTemplate`).
- `createRateLimiter(windowMs, max)` — in-memory token bucket per phone number id.
- Bounded retry/backoff for transient failures (5xx, 429, Meta rate codes 80007
  and 131056). `fetch` is injectable for tests; no network call in unit tests.
- Never logs message bodies, tokens, or phone numbers. Errors are generic.

## Safety / honesty

- The `messages.status` check constraint allows `sent` (migration
  `20260905120000_outbound_sent_status.sql`). `sendApprovedDraft` persists the
  returned `wamid` as `wa_message_id` and flips the row to `sent` on success
  (or reports `persist_failed` when the update fails after a real send).
- The 24-hour service window is enforced against **real inbound history** by
  `sendApprovedDraft` before any free-form send; template sends are validated
  and allowed outside the window.
- Send history and `sent` transitions are captured by the outbound audit trail
  (`20260905140000_outbound_audit_trail.sql`).
- No outbound send has occurred: `WHATSAPP_OUTBOUND_ENABLED` stays `false` in
  every deployment until Meta registration and controlled testing pass.

## Known production-safety gaps (deferred, human-approved)

1. **Atomic pre-send claim:** `sendApprovedDraft` does not perform an
   exclusive/atomic claim on the `messages` row, so two concurrent approvals of
   the same draft could theoretically double-send. Needs a DB-level claim and a
   controlled test before production use.
2. **Rate limiting:** the in-memory `createRateLimiter` is not passed into the
   real default send path and is not durable across serverless instances -- it
   bounds only in-process test/transport usage.
3. **Retry semantics:** a Meta HTTP success followed by a database persistence
   failure returns `persist_failed`; the delivery-funnel and auditing implications
   of retrying that specific state are not yet defined.
4. A controlled end-to-end test with one known-good number **after** Meta
   registration succeeds. Keep `WHATSAPP_OUTBOUND_ENABLED=false` until then.

## Tests

`lib/outbound/whatsappSender.test.ts` (mocked fetch):
fail-closed config parsing, no-fetch when disabled, invalid recipient/empty
body rejection, correct endpoint/headers/payload on success, transient-retry
then success, non-transient single-attempt failure, network-failure exhaustion,
rate-limit short-circuit, body truncation, transient classification, and
rate-limiter window reset.
