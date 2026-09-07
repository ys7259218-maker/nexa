# Nexa handoff

## CURRENT TASK

Bound the two remaining unbounded inbox queries so the pages stay correct and
bounded past Supabase's 1,000-row default: the conversations inbox
(conversations list + selected thread) and the opted-out customers list (which
also needs the true total even when the list is capped).

## CURRENT STATE

- Branch `main` @ `d6d7aea` (PR #153 merged), 2026-09-07.
- PRs **#151**, **#152**, **#153** (exact counts; unconditional opt-out +
  suite registration; failed-sends opt-out awareness) are **merged**.
- **Pending review:** PR **#154** (`opencode/inbox-query-bounds`) — inbox and
  opted-out query hardening. Auto mode: merge after CI green.
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
- **Unconditional opt-out (#152):** `customerOptedOut` computed from message content
  alone; `conversationAllowsDraft` forced false on opt-out with the flag off; flag still
  gates human takeover / automation mode. Registered the never-executed
  `lib/optedOutCustomers.test.ts` in `npm test` and fixed its mocks; removed the phantom
  `OptOutSource` value `"system"` the DB constraint forbids.
- **Failed-sends opt-out awareness (#153):** `listFailedSends` reads
  `customer_opted_out_at`, exposes `optedOut` per send, excludes opted-out sends from
  `retryable`; the `/failed-sends` page shows an "Opted out" chip and a reason note
  instead of a retry button (self-retry + Retry All skip them; the send-time guard
  remains the hard guarantee).
- **This PR (#154):** `getConversationInbox` caps its list (`CONVERSATIONS_LIST_LIMIT`
  = 200) and thread (`INBOX_MESSAGES_LIMIT` = 300, fetched newest-first then reversed
  to chronological) and deep-links beyond the cap by id (`.eq("id", …).maybeSingle()`,
  appended to the list). `listOptedOutCustomers` now returns
  `{ customers, total, truncated }` from a parallel head/count query plus a capped
  list (`OPTED_OUT_LIST_LIMIT` = 200); the `/opted-out` page shows the exact total and
  a "showing the newest N" note when trimmed. FakeQuery grew `limit`/`maybeSingle` and
  by-id resolution for the deep-link tests.

## VERIFIED (for this PR)

- `npm run lint` — 0 errors.
- `npm run typecheck` — clean.
- `npm test` — 405 passing (inbox cap + deep-link, opted-out count/truncation, and
  contract pins).
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

1. Auto-mode: merge PR **#154** when CI is green, then continue with the next
   code-only slice off `origin/main`, or hand to the live round-trip with the
   owner if the code queue empties.