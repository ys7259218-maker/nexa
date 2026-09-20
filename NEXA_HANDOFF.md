# Nexa handoff

## CURRENT STATUS — 2026-09-14 (refreshed 2026-09-20)

Dated, repo-derived status that **supersedes the sections below where they conflict**. Everything below this section is the 2026-09-09/10 snapshot and should be read as history. Repository content, per-PR records, and the recorded 2026-09-20 production checkpoint below are cited; other live provider state is not re-verified here.

- **PR #184** (`docs/reconcile-operational-truth-v1`) was based on `main` @ `8318489` (the #183 integration-cleanup merge; #182 migration constraint normalization also merged atop the list below); its exact reviewed head was `35b4f873`, and it was squash-merged into `main` as `4753ce0a`. `8318489` was the reviewed base SHA, not PR #184's head. The base was reached after the 2026-09-10 post-merge audit, which covers through #174 (Vercel production-build guard): #168 (Draft-Assist inbound-only design and fail-close rollout gate), #169 (atomic pre-send claim prevents duplicate concurrent outbound approvals), #170 (contained webhook ledger + bounded API bodies), #171 (narrowed database API role privileges), #172 (removed the unused Firebase client surface), #173 (guard against committed secrets in tracked files), #174 (Vercel production-build guard), #175 (docs reconcile), #180 (deps/Supabase-CLI-pin), #181 (owner go-live approval intent + handoff refresh), #182 (audit entity-type constraint normalization migration), #183 (fail-safe guarded cleanup for issue-report residue).
- **PR #174 production-build guard — exact boundary:** a Vercel production build (`VERCEL_ENV=production`, which is what a GitHub merge to `main` triggers) is blocked at `next.config.ts` load unless all of the following hold: the reviewed production-readiness signal `PRODUCTION_RELEASE_APPROVED` is set to its exact documented value; `NEXT_PUBLIC_SUPABASE_URL` is not the exact staging hostname `vbizuxxgjlwqotuegskq.supabase.co`; and the unchanged closed-beta preflight passes (`AI_PROVIDER=mock`, every rollout/outbound flag explicitly false, including `WHATSAPP_OUTBOUND_ENABLED=false`). It gates the **current tracked tree's build only** — it does not create, verify, back up, or roll back a production Supabase project and does not substitute for owner-gated provider actions. Preview/CI/local builds stay usable.
- **Production readiness boundary (verified 2026-09-20 checkpoint):** the dedicated **production** Supabase project `nkxhlugrprdtqyqcahfx` **exists**; the canonical migrations are applied **24/24**; production RLS integration (`npm run test:integration`) passed **14/14** against it; synthetic `issue_reports` residue is verified **zero** after the guarded cleanup. The staging project `nexa-beryl-gamma` (`vbizuxxgjlwqotuegskq`) is separate and is rejected as a production target by the guard. Production/provider/provider-configuration actions remain owner-gated (see `docs/OPERATIONS_RUNBOOK.md` release gates); the live Vercel environment and the remaining backup/restore/deploy/activation gates are not re-verified here.
- **Migrations:** the repo now tracks **24** migrations (`supabase/migrations/`, monotonic chain; newest `20260919120000_audit_entity_type_constraint_normalization_v1.sql`), superseding the "21/21" claim in LIVE STATE below.
- **Activation evidence is no longer "still empty":** the live verifier proof is recorded (commit `158b98a`, task snapshot below): evidence row fresh, `outbound_enabled=false` → `incomplete` → agent locked. The "still empty" line in LIVE STATE below is the pre-proof snapshot and is superseded.
- `npm run check` is green at the current PR head (554 unit tests passing — `main` @ `cd5920e` had 553 (PR #186's six global-search contract tests); PR #185's head `7adddfc` had 547 and PR #184's head was 541; this change adds one test for the stale-window fix in `serviceWindowRemainingMs` — enforced by `npm run check:documented-count` against the runner total at the same head; `npm audit` 0 vulnerabilities). Operational gates live in `docs/OPERATIONS_RUNBOOK.md`; go-live steps live in `docs/GO_LIVE.md`.
- **2026-09-14 owner go-live approval intent** is recorded in `docs/GO_LIVE.md` — a record only, not release approval and not production-readiness evidence. The production project now exists with migrations 24/24 applied and RLS integration 14/14 pass recorded (2026-09-20 checkpoint above), but a production deploy remains gated on the remaining owner actions listed there (set the guard signal + flags false in Vercel production env, complete the backup/restore drill, then deploy + smoke and remove the guard signal); provider activation remains owner-gated.

## CURRENT TASK

Live WhatsApp round-trip on staging is **confirmed** (2026-09-09, owner+
Codex). `nexa-beryl-gamma` serves staging (`vbizuxx…`), Meta `messages`
webhook delivers to it, and ingest stores + processes inbound. Activation
evidence verifier shipped in #162 (merged `c32c71e`); activation stays locked
(outbound `false`).

Remaining work, in order (owner cannot act manually right now — hand off to
an agent with Vercel + app-owner access):

1. ~~**Deploy env**~~ ✅ DONE 2026-09-10: `WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED=true`
   set on Vercel project `nexa` (targets production + preview, id
   `muGvW7jZpb5JbVXa`) with the owner's token; production redeployed from
   `93ffda4` (deploy `dpl_4ZTMqyQ6cRfMid7okxq9yGPshYoT`, READY). `nexa-beryl-gamma`
   now serves the new build. Verified live: `/api/health` 200, webhook GET
   challenge 200 (deploy token = local), POST no-sig 401. Outbound still `false`.
2. ~~**Agent content**~~ ✅ DONE (staging-labelled, 2026-09-10): `timezone`=
   `Asia/Kolkata`, `working_hours`=`Mon-Sat 09:00-21:00 IST (staging test
   schedule; agent is Draft and not serving customers yet)`, `knowledge_notes`=
   explicit "staging verification agent — replace with reviewed sources before
   rollout". Truthful, reversible, no fabrication. `business_description` and
   `greeting_message` were already set. Replace with real content before any
   rollout.
3. **Authenticated verification click (OWNER/Codex only):** `owner` login on the
   deploy → `/ai-employees/80232f79-…` → "Re-run server verification". Evidence
   row must record `outbound_enabled=false` → `incomplete` → lifecycle stays
   locked. This one step needs a human session; it cannot be done service-side.
   ✅ DONE 2026-09-10: evidence row exists (verified_at 16:58:30Z, fresh);
   `channel_linked=true, webhook_configured=true, inbound_ready=true,
   outbound_enabled=false`; verified_by = nexa-test-a account (RLS owner).
   Agent stays locked — fail-closed proof complete.
4. **Outbound:** only after an explicit approved, known-number real send test —
   then a real token + verifier re-run, and only then activation.

Ready-ness snapshot (2026-09-10, live staging data; deploy is source of truth):
`identity` READY, `behavior` READY, `voice` READY, `knowledge` READY,
`channel` READY deploy-side (flag true) / MISSING in local mirror (flag false),
`runtime` READY, `outbound` MISSING (by design). `LOCAL_ENV_ALL_READY=false`
only because of the local flag; deploy-side everything except outbound is READY.

Meta-side is done (fields subscribed, verify token matches
`nexa-beryl-gamma` and `.env.local`).

As of 2026-09-10 (post-merge audit, read-only):
- PR #167 merged (squash `c3c52d2`): accessibility refresh — transition-backed
  retry, section landmarks, honest sign-out; callers augmented via uiContracts
  (110/110). Supersedes stale #28–#32 (do not merge them).
- Open issues: 0. Remaining open PRs all do-not-merge: #28–#32 (superseded),
  Dependabot #3–#6 (ESLint 10 plugin incompat / @types/node 26 vs Node 22 /
  stale majors).
- Audit of every remaining blueprint ⚠️ row: all either manual AT/browser audits,
  rollout-gated env/migrations, or production infra needing owner access (MFA,
  monitoring/alerting, backup-restore drill, live RLS proof). The "remaining
  settings forms" baseline row is effectively covered: `IssueReportingPanel` has
  labels/bounds/`aria-busy`/focused feedback, and the `/settings/*` pages are
  read-only readiness dashboards (no un-audited input forms found).
- CONCLUSION: **no safe code-only task remains.** Manufacturing one would violate
  the no-fabrication / no-code-only-slicing rules. The unblock is the 3-step
  manual sequence above (Vercel flag → real agent content → owner verification
  click), then outbound only on explicit approval.

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