# Nexa handoff

## CURRENT TASK

Make the failed-sends page honest about its own cap. The list was already
bounded at `DEFAULT_FAILED_SENDS_LIMIT` = 200, but the page showed only the
loaded rows with no indication that older failures existed — unlike the
opted-out and approvals pages, which surface the exact total via a head/count
query. This slice applies the same `{ list, total, truncated }` pattern to
failed sends.

## CURRENT STATE

- Branch `main` @ `5c328d3` (PR #156 merged), 2026-09-07.
- PRs **#151**–**#156** are all **merged** (delivery exact counts; unconditional
  opt-out; failed-sends opt-out awareness; inbox/opted-out query bounds; inbox
  database search; bounded approvals + scoped failed-sends lookups).
- **Pending review:** PR **#157** (`opencode/failed-sends-exact-total`) — exact
  failure total + truncation on the failed-sends page. Auto mode: merge after CI
  green.
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
- **This PR (#155):** `getConversationInbox` accepts a third `customerSearch`
  argument; when the operator enters a number, the conversations list is fetched
  from the database (`.ilike("customer_wa_id", "%<digits>%")`, bounded to
  `CONVERSATIONS_LIST_LIMIT`) instead of only the newest rows, so old conversations
  stay reachable by search. The value is the already-digit-sanitized
  `parseCustomerSearchValue`, so LIKE wildcards cannot be injected. The
  `/conversations` page passes `customerQuery` through and the client-side digit
  filter still applies on top.
- **This PR (#156):** `listPendingApprovals` now fetches drafts bounded
  (`PENDING_APPROVALS_LIMIT` = 500), looks up conversations only for those drafts
  (`.in("id", conversationIds)`), and window-binds the inbound scan
  (`INBOUND_WINDOW_SCAN_MS` = service window); it returns
  `{ approvals, total, truncated }` from an exact head/count so the real backlog
  is never hidden by the cap. `listFailedSends` stops loading every conversation:
  it reads the failed sends first, then fetches only their conversations
  (`.in("id", …)`); the retry path is unchanged (per-send re-verification) and the
  empty-queue case issues no conversations query at all. The `/pending-approvals`
  page now shows "N drafts waiting for approval · showing the newest M".
- **This PR (#157):** `listFailedSends` now returns `{ sends, total, truncated }`
  from a parallel exact head/count of outbound `failed` rows, so the display cap
  never hides the true failure backlog. The `/failed-sends` page shows
  "N failed sends · M retryable of T total, showing the newest N" (or plain
  "· T total" when untrimmed); `retryFailedSends` consumes `data.sends`. Retry
  semantics and per-send re-verification are unchanged.

## VERIFIED (for this slice set: #151–#157)

- `npm run lint` — 0 errors.
- `npm run typecheck` — clean.
- `npm test` — 408 passing (approval caps/count/truncation, scoped failed-sends
  conversation lookup, window-bounded inbound scans, and contract pins).
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

1. Auto-mode: merge PR **#157** when CI is green. The code queue is then empty
   again; the next real step is the **live round-trip** with the owner: real
   Supabase migrations + RLS evidence, Meta WABA send/receipt/opt-out, OpenAI
   key, and the env-gated knowledge/registry/version-history features behind
   migration + RLS gates. No further code-only slicing should be invented just to
   keep merging — each PR carries risk, and the remaining candidates are either
   blocked or not worth the churn.