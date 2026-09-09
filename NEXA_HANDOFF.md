# Nexa handoff

## CURRENT TASK

Live WhatsApp round-trip on staging is **confirmed** (2026-09-09, owner+
Codex). `nexa-beryl-gamma` serves staging (`vbizuxx…`), Meta `messages`
webhook delivers to it, and ingest stores + processes inbound. Activation
evidence verifier shipped in #162 (merged `c32c71e`); activation stays locked
(outbound `false`).

Remaining owner/Codex work, in order:

1. Fill the staging agent's knowledge (app UI) so the `knowledge` check passes.
2. Keep `WHATSAPP_OUTBOUND_ENABLED=false` until a real known-number outbound
   send test is explicitly approved. Then: provide a real token, run the
   verifier via "Re-run server verification", confirm the evidence row is
   complete, and only then change the lifecycle.
3. Meta-side is done (fields subscribed, token matches `nexa-beryl-gamma` and
   `.env.local`).

Rules unchanged: the EAAT token may sit in `.env.local` but the app never
sends; no production writes; delete pasted token files after use.

## LIVE STATE (nexa-staging-test)

- Migrations full parity (21/21). RLS integration 14/14 pass live (q.v.).
- Inbound round-trip **proven** 2026-09-09: Meta → `nexa-beryl-gamma` →
  signature → channel-resolve → inbound stored + `processed`. `webhook_events`
  rows: three `wamid.*` events (`processed`, empty `last_error`); `messages`
  direction `inbound`, bodies "nexa connected" (17:14Z) and "Hi" (18:19Z);
  2 conversations. My earlier synthetic `OWNERPROBE0001` stays `skipped:
  unknown_channel` (pre-channel-link, cosmetic).
- Channel `1339649782559038` linked to agent `80232f79-…`; one agent
  Draft/paused, knowledge empty. `ai_employee_activation_evidence` still empty
  (verifier not run yet; deployed with next 16.3.4).

## COMPLETED (code, all CI-green on `main`)

- **Activation evidence verifier (#162):** server-only `verify-activation` route
  writes fresh `ai_employee_activation_evidence` (24h TTL) only when auth +
  ownership + channel + webhook + inbound + outbound checks all pass; fail-closed
  on write error; request body ignored. Outbound-disabled evidence records as
  `incomplete` (locked), and the guarded lifecycle RPC enforces the second
  boundary. Lockfile security bumps in the same PR (next 16.3.4, sharp 0.35.4,
  js-yaml 4.3.2) clear the day-0 critical audit advisories (0 vulnerabilities).
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
- **This PR (#158):** `getConversationInbox` returns `totalConversations`,
  `listedConversations`, `conversationsTruncated`, `totalMessages`, and
  `messagesTruncated` from parallel head/count queries, so the inbox now states
  "N chats · showing the newest M" (and "N messages · showing the newest M" on
  the thread) instead of silently capping at 200/300. `listedConversations`
  excludes a deep-linked conversation appended beyond the cap, so "newest M"
  stays truthful.

## VERIFIED (for this slice set: #151–#158)

- `npm run lint` — 0 errors.
- `npm run typecheck` — clean.
- `npm test` — 408 passing (approval caps/count/truncation, scoped failed-sends
  conversation lookup, window-bounded inbound scans, and contract pins).
- `npm run build` — production build compiles.
- Browser smoke — Playwright against local `next start` (5/5).
- `npm audit` — 0 vulnerabilities.

## REAL BLOCKERS (cannot be advanced from CI)

- **Outbound send proof** needs owner creds: real Meta WABA send/receipt/opt-out
  (blocked by design — `WHATSAPP_OUTBOUND_ENABLED=false`). OpenAI key, Sentry DSN.
- **Knowledge v0 / registry / version-history** are env-gated behind migration + RLS
  gate passes.
- **Activation unlock** requires fresh complete server evidence; the operator must
  fill knowledge and re-run the verifier after outbound is approved and real.
- **Backup restore drill / incident runbook** need a provisioned production project.

## REMAINING (deferred, human-approved)

- Enable outbound only after the controlled known-number live test passes on a dedicated
  Supabase project; keep `WHATSAPP_OUTBOUND_ENABLED=false` and audit-logged flips until then.
- Fill the staging agent's knowledge so the `knowledge` prerequisite turns green.

## SAFEST NEXT ACTION

1. Owner fills the staging agent's knowledge (UI), then runs "Re-run server
   verification" on the staging deploy: the resulting evidence row must record
   `outbound_enabled=false` → `incomplete` → locked (proves the verifier end to
   end). No further code-only slicing should be invented just to keep merging —
   each PR carries risk, and the remaining candidates are either blocked or not
   worth the churn.