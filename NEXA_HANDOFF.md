# Nexa handoff

## CURRENT TASK

Fix the verified Nexa review issues before starting any new feature:

1. Delivery-funnel and dashboard accuracy across more than 1,000 outbound messages
   (exact aggregate count queries instead of Supabase's capped status fetch).
2. Refresh this handoff to actual GitHub state.

## CURRENT STATE

- Branch: `main` @ `bd5d25a` (`bd5d25a8e445c86527dc5461f3b679d7c0381106`), 2026-09-07.
- PR **#35** (outbound sender transport + session-window/template policy) is **merged**.
- PR **#150** (dashboard failed-sends stat link) is **merged**.
- **Pending review:** PR **#151** (`opencode/...` branch) — delivery-funnel exactness +
  handoff refresh. Created, NOT merged, per protocol (review before merge). No
  migrations, no production changes.
- This fix is **query-only**. No migration is applied or bundled; production is untouched.

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
- **This PR (#151):** delivery funnel + dashboard now read exact per-stage tallies via
  four `count: "exact"`/`head: true` aggregate queries (`countOutboundDeliveryStages`
  in `lib/deliveryFunnel.ts`), single-rate source `combineDeliveryCounts`, exact past
  1,000 outbound messages. Also **registered `lib/deliveryFunnel.test.ts` in `npm test`**
  (it was written but never executed — a test-suite-integrity gap).

## VERIFIED (for this PR)

- `npm run lint` — 0 errors.
- `npm run typecheck` — clean.
- `npm test` — full suite incl. the newly-registered delivery-funnel tests; regression
  coverage past 1,000 records on both the funnel and the dashboard snapshot.
- `npm run build` — production build compiles.
- Browser smoke — Playwright against local `next start` (health gate then smoke run).
- `npm audit` — 0 high/critical vulnerabilities.

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

1. Review and merge PR **#151** when ready (gate already green; no migrations).
2. Next code-only slice off `origin/main` if the queue remains unblocked; otherwise the
   live round-trip with the owner (accounts required) is the highest-value next step.