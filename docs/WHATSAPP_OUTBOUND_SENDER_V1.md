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

## Pre-send atomic claim (lib/server/outboundClaim.ts)

Before any transport call, `sendApprovedDraft` asks the database to claim the
exact `messages` row (migration `20260911164532_outbound_atomic_claim_v1.sql`).
The claim is a single atomic conditional `UPDATE` whose `WHERE` embeds every
eligibility predicate, so PostgreSQL row-lock semantics make **exactly one**
concurrent approval win; every loser returns `already_claimed` and never calls
the transport.

- `claim_outbound_message_send(message_id, owner_user_id)` reserves the row
  once (`send_claim_token`, `send_claim_issued_at`). Denials are classified
  honestly (`already_claimed`, `not_found`, `not_draft`, `opted_out`,
  `human_takeover`, `ineligible`), with ownership checked before any state
  detail so another user's messages are never distinguishable. Human takeover
  is evaluated from **both** independent signals with an AND: the claim is
  refused when `automation_mode = 'human'` and also when `human_takeover_at`
  is non-null.
- On a successful transport send, `finalize_outbound_message_send` flips the
  row to `sent` with the `wamid`, `sent_at`, and optional template only when
  the caller presents the **same claim token**; a mismatched token changes
  nothing. The `wa_message_id` is deliberately allowed to be already non-null:
  a delivery receipt may have flipped a sent row to `failed` while keeping its
  old wamid, and an explicit retry of that row finalizes under the same claim
  token with the new wamid (the old one is overwritten).
- Certain no-send transport outcomes (`not_ready`, `invalid`, `rate_limited`)
  `release_outbound_message_send` the claim so the draft stays retryable.
- An ambiguous transport `error` (network timeouts, 5xx, exhausted retries) is
  **conservative**: the claim is retained, there is no silent auto-resend nor
  automatic release, and the draft will report `already_claimed` until an
  operator verifies delivery and releases the claim manually (release only
  works with the matching token; no claim stealing). Because Meta acceptance
  may be unknown, the failure message is honest: delivery could not be
  confirmed and must be verified by an operator before any retry.
- Claim, finalize, and release are `SECURITY INVOKER` functions callable only
  by `service_role` (revoked from `public`, `anon`, `authenticated`) with
  explicit owner/workspace predicates; RLS alone is never relied on, because
  the service-role client bypasses it.
- An RPC-level failure always fails closed: nothing is sent (`claim_failed`),
  and a real send whose status cannot be recorded reports `persist_failed`
  honestly.

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
  `20260905120000_outbound_sent_status.sql`). `sendApprovedDraft` finalizes the
  claim into `sent` with the returned `wamid` as `wa_message_id` (or reports
  `persist_failed` when the claim cannot be recorded after a real send). The
  old broad direct `UPDATE` on `messages` is gone: status persistence is
  now conditional on the matching claim token.
- The 24-hour service window is enforced against **real inbound history** by
  `sendApprovedDraft` before any free-form send; template sends are validated
  and allowed outside the window.
- Send history and `sent` transitions are captured by the outbound audit trail
  (`20260905140000_outbound_audit_trail.sql`).
- No outbound send has occurred: `WHATSAPP_OUTBOUND_ENABLED` stays `false` in
  every deployment until Meta registration and controlled testing pass.

## Known production-safety gaps (deferred, human-approved)

1. **Rate limiting:** the in-memory `createRateLimiter` is not passed into the
   real default send path and is not durable across serverless instances -- it
   bounds only in-process test/transport usage.
2. **Retry semantics:** retrying a `persist_failed` state (Meta accepted, DB
   record missing) is not defined end-to-end. The conservative boundary today
   is: no auto-resend; operators verify delivery and release the retained claim
   manually.
3. A controlled end-to-end test with one known-good number **after** Meta
   registration succeeds. Keep `WHATSAPP_OUTBOUND_ENABLED=false` until then.
4. Ambiguous transport `error` claims must be released manually by operators
   after delivery verification (there is intentionally no automatic claim
   expiry or stealing).

## Tests

`lib/outbound/whatsappSender.test.ts` (mocked fetch):
fail-closed config parsing, no-fetch when disabled, invalid recipient/empty
body rejection, correct endpoint/headers/payload on success, transient-retry
then success, non-transient single-attempt failure, network-failure exhaustion,
rate-limit short-circuit, body truncation, transient classification, and
rate-limiter window reset.

Atomic-claim coverage (same file, fake service with an `.rpc` claim registry):
two concurrent approvals produce exactly one claim, one transport call, and one
`already_claimed` loser; a pre-held claim never reaches the transport; an RPC
claim failure reports `claim_failed` with no send; DB-level denials map to
honest outcomes (`human_takeover` is tested from each independent signal alone,
with AND semantics matching the SQL); certain no-send outcomes release the
claim while an ambiguous `error` retains it and returns unconfirmed-delivery
wording; a failed retry that kept its old `wa_message_id` finalizes to `sent`
with the new wamid under the matching claim token; finalize succeeds only with
the matching token; release clears only the matching token; claim/finalize/
release fail closed on RPC errors. Static migration-contract tests in
`lib/workspaceMigrations.test.ts` pin the additive, owner-scoped,
service-role-only SQL and the AND takeover predicate.
