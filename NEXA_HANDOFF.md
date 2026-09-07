# Nexa handoff

## CURRENT TASK

Make the failed-sends retry queue opt-out aware: a customer who opted out after a
send failed must not look retryable, must not get a retry button, and must not be
counted in "Retry N retryable". The send-time guard already blocks opted-out sends
(hard guarantee); this slice fixes the misleading work queue.

## CURRENT STATE

- Branch: `main` @ `156c1cd` (PR #152 merged), 2026-09-07.
- PR **#151** and **#152** (exact counts; unconditional opt-out + suite registration)
  are **merged**.
- **Pending review:** PR **#153** (`opencode/...` branch) — failed-sends opt-out
  awareness. Auto mode: merge after CI green.
- Query/page/test-only. No migrations, no production changes.

## COMPLETED (code, all CI-green on `main`)

- **WhatsApp outbound in or after #35:** fail-closed transport (`whatsappSender.ts`,
  `sessionWindow.ts`, `validation.ts`), approve-and-send (`sendApprovedDraft`,
  `/api/outbound/draft`, `DraftSendButton`), template sends (#140).
- **Failed-sends retry queue (#143, #145):** `/failed-sends`, `listFailedSends`
  (window semantics), batch retry (`retryFailedSends`, `MAX_BATCH_MESSAGE_IDS=20`,
  8KB body cap, per-message re-verification).
- **Meta failure reasons (#146, #147):** `messages.failure_reason` (additive, bounded
  1–400 chars), parsed from failed receipts, surfaced on the retry queue and the
  conversation inbox.
- **Bounded queue scans (#148):** inbound scan filtered to the 24h window; failed-sends
  list capped at 200; retry scans to its own 1,000 cap so Retry All still sees the full
  set.
- **Dashboard ops loop (#150):** "Failed sends → Review & retry" stat links to
  `/failed-sends`.
- **Delivery metrics exact (#151):** funnel + dashboard read per-stage tallies via four
  `count: "exact"`/`head: true` aggregate queries (`countOutboundDeliveryStages`),
  single-rate source `combineDeliveryCounts`; also registered the never-executed
  `lib/deliveryFunnel.test.ts` in `npm test`.
- **This PR (#152):** `customerOptedOut` is computed from message content alone and
  `conversationAllowsDraft` is forced false on opt-out, so recording + draft-blocking
  run with the flag off; the flag still gates human takeover / automation mode. Also
  **registered `lib/optedOutCustomers.test.ts`** (was written but never executed) and
  fixed its mocks (`not` no longer returns a Promise, breaking `.order()` chaining);
  removed the phantom `OptOutSource` value `"system"` that the DB constraint forbids.
- **This PR (#153):** `listFailedSends` reads `customer_opted_out_at` from the
  conversations row, exposes `optedOut` per send, and excludes opted-out sends from
  `retryable`; the `/failed-sends` page shows an "Opted out" chip and a reason note
  instead of a retry button (self-retry + Retry All both skip them; the send-time
  guard remains the hard guarantee).

## VERIFIED (for this PR)

- `npm run lint` — 0 errors.
- `npm run typecheck` — clean.
- `npm test` — 402 passing (incl. the opt-out-aware failed-sends coverage and pinning
  contract updates).
- `npm run build` — production build compiles.
- Browser smoke — Playwright against local `next start` (5/5).
- `npm audit` — 0 vulnerabilities.

## REAL BLOCKERS (cannot be advanced from CI)

- **Live round-trip evidence** needs owner creds: real Supabase migrations + RLS
  evidence, Meta WABA send/receipt/opt-out, OpenAI key, Sentry DSN.
- **Knowledge v0 / registry / version-history** are env-gated behind migration + RLS
  gate passes.
- **Backup restore drill / incident runbook** need a provisioned production project.

## REMAINING (deferred, human-approved)

- Enable outbound only after the controlled known-number live test passes on a dedicated
  Supabase project.
- Keep `WHATSAPP_OUTBOUND_ENABLED=false` and audit-logged flips until then.

## SAFEST NEXT ACTION

1. Auto-mode: merge PR **#153** when CI is green, then continue with the next
   code-only slice off `origin/main` (inbox/opted-out unbounded-query hardening is
   next), or hand to the live round-trip with the owner if the code queue empties.