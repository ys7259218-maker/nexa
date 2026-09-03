# Nexa handoff

## CURRENT TASK

Outbound WhatsApp sender transport/policy slice (Phase 3, handoff item #6 partial),
including template message send support.

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
- **Template send support (new):** `sendTemplateMessage` + `buildTemplatePayload`
  reuse the same fail-closed transport but validate the template reference
  through `validateTemplate` (bounded name/language/params) and build a Meta
  `type: "template"` payload. Shared send loop is factored into an internal
  `performSend` core used by both text and template sends (ready gate, E.164
  check, rate limit, retry/backoff).
- `lib/outbound/validation.ts`: E.164 recipient guard.
- `lib/outbound/whatsappSender.test.ts`: 18 unit tests with mocked fetch
  (no real network, no real keys) — 12 transport + 6 template.
- `lib/outbound/sessionWindow.ts`: pure, deterministic WhatsApp 24-hour
  session-window + template policy (`resolveAllowedMessageKind`,
  `isWithinServiceWindow`, `validateTemplate`). The policy that decides what
  kind of message may be sent; the transport applies it on integration.
- `lib/outbound/sessionWindow.test.ts`: 9 unit tests (window boundary at exactly
  24h closes to template; no-inbound/future/unparsable force template; bounded
  template validation).
- Wired both new tests into `package.json` `test` script.
- `.env.example`: documented outbound transport vars (all inert placeholders).
- `docs/WHATSAPP_OUTBOUND_SENDER_V1.md`: design, safety, deferred items.

## VERIFIED

- `npm run check` EXIT=0: lint, typecheck, full test suite (183 baseline + 18 outbound
  sender + 9 session-window + 3 issue-reports = 213), production build compiles.
- `npm audit` (high): 0 vulnerabilities.
- Local Supabase migration verification (`npm run verify:supabase:local`) PASSED
  in Docker (16 canonical migrations, `db lint` no schema errors). This was a
  previously-missing checkpoint because this machine lacked Docker; now Docker
  Desktop 29.7.2 is available and the engine is running.

## REMAINING (deferred, human-approved; NOT in this slice)

- Wire sender + session-window policy into the WhatsApp processor behind the
  flag + apply a migration to extend `messages.status` with `sent` (check
  constraint does not allow it yet).
- Feed real inbound history into `resolveAllowedMessageKind` before any send.
- Database-driven rate/cost policy.
- Controlled known-number end-to-end test AFTER Meta registration succeeds.
- Keep `WHATSAPP_OUTBOUND_ENABLED=false` throughout.

## BRANCH / PR

`opencode/outbound-sender-v1` — **pushed successfully** to `origin`.
- Commits: `aa4d032` (fail-closed outbound WhatsApp sender transport),
  `2293328` (session-window/template policy), `5d8912c` (checkpoint),
  `aacf21c` (outbound template message send).
- **PR merged-proof state:** GitHub PR **#35** created and open,
  title "Add fail-closed outbound WhatsApp sender transport + session-window/
  template policy", targeting `main`. Status: **OPEN, MERGEABLE** (no conflicts).
  Awaiting review. **NOT merged** and must not be merged until reviewed.
- Merge not performed. Production untouched. No migration applied.

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

1. Review and merge PR #35 (`opencode/outbound-sender-v1` → `main`) when ready.
2. Human-approved integration step wires the sender + `sent` migration behind
   the still-false flag.
3. Run dedicated two-account/RLS and the controlled known-number test on a
   dedicated Supabase project before enabling outbound.
4. Next independent code-only slice off `origin/main` (after #35 merges) once
   the queue is unblocked.
