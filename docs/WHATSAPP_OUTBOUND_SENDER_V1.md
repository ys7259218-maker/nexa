# Outbound WhatsApp sender — transport/policy slice (v1)

## Status

**Done in code, transport-only, NOT runtime-enabled.**

A fail-closed Meta WhatsApp Cloud API outbound text transport and policy layer
now exists at `lib/outbound/whatsappSender.ts`. It is intentionally **not wired
into any runtime path** and cannot send a real message on its own.

## Session-window / template policy (lib/outbound/sessionWindow.ts)

A companion pure, deterministic policy module encodes Meta's delivery rules so
the transport never sends a legally-unavailable message:

- `resolveAllowedMessageKind(lastInboundAt, now)` →
  `{ kind: "freeform" | "template", withinWindow }`. Free-form is allowed only
  while the 24-hour customer service window is open (strictly inside 24h of the
  recipient's last inbound message); no inbound record, an older inbound, a
  future inbound, or an unparsable timestamp all force template mode.
- `isWithinServiceWindow(...)` — convenience boolean.
- `validateTemplate({ name, language, componentParams })` — bounds and validates
  a template reference (conservative `[A-Za-z0-9_]` name, bounded language and
  component params) so unbounded/malicious input is never forwarded.

It is NOT wired into any runtime path and makes no network calls.

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
- `createRateLimiter(windowMs, max)` — in-memory token bucket per phone number id.
- Bounded retry/backoff for transient failures (5xx, 429, Meta rate codes 80007
  and 131056). `fetch` is injectable for tests; no network call in unit tests.
- Never logs message bodies, tokens, or phone numbers. Errors are generic.

## Safety / honesty

- The `messages.status` check constraint does **not** yet allow `sent`, so this
  slice does **not** persist outbound messages or change any runtime behavior.
  Persisting the returned `wamid`/status needs a migration and is deferred.
- Template message sending **is** implemented as a transport (`sendTemplateMessage`
  + `buildTemplatePayload`, validated via `validateTemplate`), and the session-window
  policy decides freeform-vs-template. But nothing is wired into a runtime path:
  free-form text replies are only legal within the Meta service window, and
  enforcement against **real inbound history** plus database-driven rate/cost
  controls remain a later integration step.
- No migration, no runtime change, no flag flip, no outbound send has occurred.

## Deferred (human-approved, still behind the flag)

1. Wire the sender into the WhatsApp processor behind `WHATSAPP_OUTBOUND_ENABLED`
   plus an applied migration to extend `messages.status` with `sent`.
2. Enforce the 24-hour session window from real inbound history before sending
   any free-form reply.
3. Database-driven rate/cost policy (the transport already supports template
   sends behind the same flag).
4. A controlled end-to-end test with one known-good number **after** Meta
   registration succeeds. Keep `WHATSAPP_OUTBOUND_ENABLED=false` until then.

## Tests

`lib/outbound/whatsappSender.test.ts` (12 cases, mocked fetch):
fail-closed config parsing, no-fetch when disabled, invalid recipient/empty
body rejection, correct endpoint/headers/payload on success, transient-retry
then success, non-transient single-attempt failure, network-failure exhaustion,
rate-limit short-circuit, body truncation, transient classification, and
rate-limiter window reset.
