# Nexa handoff

## CURRENT TASK

Outbound WhatsApp sender transport/policy slice (Phase 3, handoff item #6 partial).

## COMPLETED

- New isolated branch `opencode/outbound-sender-v1` from `origin/main` (`f6463d1`).
- `lib/outbound/whatsappSender.ts`: fail-closed Meta Cloud API outbound text
  transport that can only send when `WHATSAPP_OUTBOUND_ENABLED=true` **and** a
  non-empty `WHATSAPP_ACCESS_TOKEN` **and** a non-empty
  `WHATSAPP_PHONE_NUMBER_ID` are present. Provides `parseOutboundConfig`,
  `isOutboundSendReady`, `sendTextMessage` (typed outcome), `buildTextPayload`,
  `createRateLimiter`, and bounded retry/backoff on transient failures
  (5xx / 429 / Meta codes 80007 & 131056). `fetch` is injectable. Never logs
  message bodies, tokens, or numbers.
- `lib/outbound/validation.ts`: E.164 recipient guard.
- `lib/outbound/whatsappSender.test.ts`: 12 unit tests with mocked fetch
  (no real network, no real keys).
- `lib/outbound/sessionWindow.ts`: pure, deterministic WhatsApp 24-hour
  session-window + template policy (`resolveAllowedMessageKind`,
  `isWithinServiceWindow`, `validateTemplate`).
- `lib/outbound/sessionWindow.test.ts`: 9 unit tests (window boundary at exactly
  24h closes to template; no-inbound/future/unparsable force template; bounded
  template validation).
- Wired both new tests into `package.json` `test` script.
- `.env.example`: documented outbound transport vars (all inert placeholders).
- `docs/WHATSAPP_OUTBOUND_SENDER_V1.md`: design, safety, deferred items.

## VERIFIED

- `npm run check` EXIT=0: lint, typecheck, full test suite (183 baseline + 12 outbound
  sender + 9 session-window + 3 issue-reports), production build compiles.
- `npm audit` (high): 0 vulnerabilities.

## REMAINING (deferred, human-approved; NOT in this slice)

- Wire sender + session-window policy into the WhatsApp processor behind the
  flag + apply a migration to extend `messages.status` with `sent` (check
  constraint does not allow it yet).
- Feed real inbound history into `resolveAllowedMessageKind` before any send.
- Template messages and database-driven rate/cost policy.
- Controlled known-number end-to-end test AFTER Meta registration succeeds.
- Keep `WHATSAPP_OUTBOUND_ENABLED=false` throughout.

## BRANCH

`opencode/outbound-sender-v1` — committed locally, NOT pushed, no PR.

## IMPORTANT FILES

- `lib/outbound/whatsappSender.ts`
- `lib/outbound/whatsappSender.test.ts`
- `lib/outbound/sessionWindow.ts`
- `lib/outbound/sessionWindow.test.ts`
- `docs/WHATSAPP_OUTBOUND_SENDER_V1.md`
- `.env.example`, `package.json`

## BLOCKERS

- Outbound sending ultimately requires Meta phone registration (external).
- `messages.status` needs a migration before real sends can be persisted.

## NEXT

1. Review this diff (Codex), then commit/merge the bounded transport.
2. Human-approved integration step wires the sender + `sent` migration behind
   the still-false flag.
3. Run dedicated two-account/RLS and the controlled known-number test on a
   dedicated Supabase project before enabling outbound.
