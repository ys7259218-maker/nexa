# Nexa handoff

## CURRENT TASK

Make customer opt-out a compliance baseline: a WhatsApp customer asking to stop
(STOP / UNSUBSCRIBE / matched phrase) is durably recorded and never receives an AI
draft, **regardless of the `CONVERSATION_SAFETY_ENABLED` rollout flag**. Also
register the never-executed `optedOutCustomers` test suite and fix its broken
query-builder mocks (another test-suite-integrity gap).

## CURRENT STATE

- Branch: `main` @ `aff09e7` (PR #151 merged), 2026-09-07.
- PR **#151** (delivery-funnel + dashboard exact counts past 1,000, handoff refresh)
  is **merged**.
- **Pending review:** PR **#152** (`opencode/...` branch) — unconditional opt-out +
  `optedOutCustomers` suite registration. Created, NOT merged, per protocol.
- Query/page/test-only. No migrations, no production changes; the preserved
  `failure_reason` migration from #146 and the conversation-safety migration are
  unchanged and still unapplied.

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

## VERIFIED (for this PR)

- `npm run lint` — 0 errors.
- `npm run typecheck` — clean.
- `npm test` — 401 passing (incl. the now-registered `optedOutCustomers` suite and the
  re-pinned opt-out-behavior test).
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

1. Review and merge PR **#152** when ready (gate already green; no migrations).
2. Next code-only slice off `origin/main` if the queue remains unblocked; otherwise the
   live round-trip with the owner (accounts required) is the highest-value next step.
   Currently scoped follow-ups: failed-sends opt-out visibility (hide/mark retry for
   opted-out customers), then the inbox/opted-out unbounded-query hardening.