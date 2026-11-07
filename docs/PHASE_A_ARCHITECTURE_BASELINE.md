# Phase A — Architecture & Documentation Consistency Baseline (Task A8)

**Audit date:** 2026-11-07 · **Mode:** read-only mapping of the actual source tree against docs. No feature claims without a file path + evidence type.

## 1. Repository naming vs "DEXYBOR"

- The repository is and remains **Nexa** (`package.json` name `nexa`; docs use Nexa/Telegram Go-Live languages); no `DEXYBOR` string appears anywhere in the tracked tree. Brand migration is explicitly out of Phase A scope (owner-planned followed phase). No renames were made.

## 2. Actual implemented surface (branch `codex/appointment-integration-v1` @ 8c70be6 + uncommitted work)

### 2.1 Implemented and verified (today)

| Capability | Evidence type | Where |
| --- | --- | --- |
| Supabase tenancy: one immutable creator-owned personal workspace, workspaces/cutover migrations, role guards | unit tests (`lib/workspaces.test.ts`, `workspaceMigrations.test.ts`) + 25 migration SQL files | `lib/workspaces.ts`, `supabase/migrations/20260824000400…`/`…000500…` |
| RLS policy review contract (19 workspace-migration contract tests incl. least-privilege API roles) | unit tests | `lib/workspaceMigrations.test.ts` |
| WhatsApp inbound pipeline: Meta signature verify, event ledger dedupe, channel assignment (`workspaceHasRole`-guarded), conversation safety (kill switch, human takeover, opt-out), mock/Knowledge draft generation, `draft_blocked` status semantics | unit tests | `lib/whatsapp.ts`, `lib/whatsappIngest.ts` (+ tests), `lib/whatsappChannels.ts`, `lib/conversationSafety.ts`, `lib/workspaceSafety.ts` |
| Outbound pipeline (human-approved sends): fail-closed feature flag `WHATSAPP_OUTBOUND_ENABLED`, draft approve+atomic claim, 24h window validation, template sends, retry queue, exact aggregate delivery metrics | unit tests | `lib/outbound/whatsappSender.ts`, `lib/outbound/sessionWindow.ts`, `lib/outbound/validation.ts`, `lib/retryFailedSends.ts`, `lib/failedSends.ts`, `lib/deliveryFunnel.ts`, `lib/dashboard.ts` |
| Knowledge v0: employee-scoped verified knowledge, deterministic FAQ drafts, source registry metadata w/ freshness + deletion proof | unit tests | `lib/knowledgeEntries.ts`, `lib/knowledgeSources.ts` |
| Employee lifecycle/versions + guarded restore; sandbox across lifecycle states; activation evidence (outbound-disabled keeps locked) | unit tests | `lib/employeeLifecycle.ts`, `lib/employeeVersions.ts`, `lib/employeeActivation.ts`, `lib/employeeSandbox.ts`, `lib/server/activationEvidence.ts` |
| Audit events with normalized entity_type allow-list; audit log UI | unit tests + UI contracts | `lib/auditEvents.ts`, `app/settings/audit/` |
| UI capability contracts (dashboard, Inbox, settings pages, privacy-safe readiness pages revealing no secret values) | UI-contract unit tests (~150 assertions) | `lib/uiContracts.test.ts` and page-level tests |
| Security infra: security headers, request body bounds, proxy routing, internal Bearer auth fail-closed, Sentry disabled-by-default w/ source-map upload still disabled | unit tests | `lib/securityHeaders.ts`, `lib/requestBody.ts`, `lib/proxyRouting.ts`, `lib/internalAuth.ts`, `lib/sentryMonitoring.ts`, `next.config.ts` |
| Google Calendar staging OAuth (see `PHASE_A_CALENDAR_REVIEW.md`) + primary-alias guard | unit tests + static review | `lib/calendar/*`, `components/calendar/`, 5 API routes |
| Deploy preflight gate incl. closed-beta environment checks + OpenAI provider fail-closed acceptance | unit tests | `lib/deployPreflight.ts` |
| Production-build guard: exact reviewed-readiness signal + staging ref rejection | unit tests | `lib/productionGuard.ts` (+ `next.config.ts` guard invocation) |

### 2.2 Implemented but not verified (no live credentials/consent/keys)

| Capability | Present | Unverified because |
| --- | --- | --- |
| OpenAI provider (`lib/ai/openAIProvider.ts`) runtime behavior | code + unit offline tests | No paid key (`OPENAI_API_KEY` unset); `AI_PROVIDER=mock` in closed beta |
| Calendar OAuth end-to-end (consent → encrypted row) | code + unit tests + runbook | Owner consent visit pending; migration applied only on staging (historical evidence) |
| Staging booking ledger / appointment-adapter live replay | harness + docs | Execution requires staging credentials; tests gated (`tests/integration/*` opt-in, NOT RUN in Phase A) |
| Migration #26 (`20260927000000_calendar_oauth_connections.sql`) | tracked file | Applied only on staging per historical runbook; production NOT applied |

### 2.3 Partially implemented (docs claim more than code)

| Capability | Gap |
 | --- | --- |
| Team invitations / MFA | UI intentionally holds back: "invitations not enabled yet; role enforcement verified first" (`app/settings/team/page.tsx`) |
| Knowledge production ingestion (file/website pull) | Registry exists; no operative ingestion worker |
| Multi-account WhatsApp routing proof | assignment code verified by unit tests; live multi-account evidence still owner-gated |
| Queue/worker processing | Inline webhook processing remains (no worker infra) |

### 2.4 Not present (DEXYBOR vision items — do not claim otherwise)

The following DEXYBOR platform capabilities from the vision statement **do not exist anywhere in this repository's reachable code** (verified by tree search + git history scan; the D7 decision docs emerging from the expired snapshot lineage describe them as *future decisions*, not products):

| DEXYBOR vision capability | Status |
| --- | --- |
| Autonomous agent engine / task planner / execution loop | NOT STARTED here |
| Durable approval_v2 / approval-consumption runtime, task checkpoints & resume, outbox recovery | Design-only (D7 documents recovered out-of-repo); no page/route in the tree |
| Tool registry, per-tool permission system | NOT STARTED |
| Browser / computer-use runtime | NOT STARTED |
| Persistent long-term memory architecture beyond bounded recent-turn sandbox memory | NOT STARTED |
| Long-running workflow orchestration / durable scheduler | NOT STARTED (inline webhook processing only) |
| Model routing / proprietary inference infrastructure ownership | NOT STARTED (mock + gated OpenAI only) |
| SSO/SCIM/marketplace ecosystem pieces (blueprint "Phase 6") | NOT STARTED |

## 3. Database & migration state

- `supabase/migrations/`: **25 tracked migration SQL files** + README (chain verified by `workspaceMigrations.test.ts` — monotonic sequence + packaged-migration-parse inclusion).
- Historical operational truth (handoff): production has 24/24 applied and RLS integration was verified (14/14) — historical claims; current server count not re-verified (no DB access in Phase A).
- A local/offline verification harness exists (`scripts/verifyLocalSupabase.ts`, `verify:supabase:local`) but requires the disposable local Supabase stack that D7-OD-02 explicitly gates.

## 4. Architecture gaps vs DEXYBOR vision (statement-level, no solutions implemented)

Per the DEXYBOR vision ("AI That Talks. AI That Acts."), the honest mapping:

1. **Talks:** conversational WhatsApp assistant with human-approval drafts and typed safety states is the strongest realized piece.
2. **Acts:** only strictly bounded "actions" exist today — WhatsApp sends behind double consent, calendar connection on staging with consent, and a booking-review queue that is human-decided. There is **no autonomous execution runtime**.
3. **Memory:** bounded recent-turn memory only; no durable long-term memory or vector store.
4. **Tooling/permissions:** no generalized tool registry; integrations (calendar) are hard-coded, fail-closed, and separate.
5. **Verification culture:** the repo's distinguishing strength — fail-closed guards, honest statuses, and 667 test contracts — is the right substrate for the future agent engine's permission layer, but nothing grants autonomy yet.

## 5. Documentation consistency notes

- `NEXA_HANDOFF.md` / `docs/GO_LIVE.md` uncommitted additions (2026-10-04 note) are accurate to the code diff (`deployPreflight` OpenAI gate + 3 tests; 667-test statement matches today's fresh run).
- `docs/BLUEPRINT_PERCENTAGE.md` (untracked) is a 2026-09-16 snapshot, already stale relative to the 09-27/10-04 work — informational only; owner decides retirement.
- D7/owner decision docs **do not exist in this repository** — they originate from the expired snapshot lineage (`nexa-snapshot-20261018-2D`) and are recovered verbatim from session history for `PHASE_A_OWNER_BLOCKERS.md`; none were re-created inside the repo.
- AGENTS.md instructs reading `node_modules/next/dist/docs/` before code-writing. Next.js installed version is **16.3.4** (`^16.3.2` in package.json, npm-run-resolved). Phase A wrote no application code; the app's Next config (`next.config.ts`) uses current syntax compatible with the installed Next.
