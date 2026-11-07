# DEXYBOR AI — MERGE & HARDEN: ARCHITECTURE & SECURITY REVIEW

**Report ID:** MH-I · **Stage:** I · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` · HEAD `8c70be6` (working tree at session-start state; integration NOT performed)
**Purpose:** verify the existing application architecture; classify DEXYBOR future capabilities strictly by real code.

---

## 1. Verified-present architecture (fresh, test-evidenced)

| Area | State (evidence) |
|---|---|
| Authentication | Supabase session cookies via `@supabase/ssr`; `proxy.ts` middleware routing enforced by tests (`proxyRouting.test.ts` 7 assertions); dashboard token revalidated server-side (`dashboard.test.ts`) |
| Workspace/tenant isolation | creator-owned personal workspace model; `workspaces.test.ts`, `teamMembers.test.ts`, RLS-backed queries with RPC guards |
| Authorization & roles | least-privilege role allow-list tests (`workspaceMigrations.test.ts`: "database API roles receive only the reviewed least-privilege allowlist"); owner/admin guards in review actions |
| RLS / migration chain | "Supabase migration chain has one explicit monotonically ordered sequence"; "packaged migrations remain identical to their reviewed SQL sources"; issue-report + knowledge + channel-assignment migrations all RLS-guarded |
| Conversation persistence & safety | `conversations.test.ts`, kill switch, human takeover, opt-out unconditional; flagged-safety banner |
| WhatsApp pipeline (in) | signature verification, webhook events ledger dedupe, processor isolation — per MH-G-W matrix (all fresh PASS) |
| WhatsApp pipeline (out) | feature-flagged sender (`draft_blocked` only in env `false`), atomic claim RPC, 24h window, retry queue with opt-out awareness, failure-reason surfacing |
| Booking & appointments | sandbox calendar provider abstraction; appointment reviews (decision/history/inbox) with origin + route gates; booking-ledger tests fresh PASS |
| Approval queues / audit | pending approvals; audit events least-privilege, entity_type narrowed fail-closed |
| Google Calendar integration | staging-only gate (`googleCalendarGate.ts` mirrors reviewRouteGate), explicit calendar id (no primary fallback), server-only token store, production opt-in flag in working tree (uncommitted) |
| AI provider abstraction | `mock` default; provider status page; safety evals; raw memory only from verified bounded sources |
| Production build guard chain | `next.config.ts` throws for production without `PRODUCTION_RELEASE_APPROVED` + non-staging URL + clean preflight; verified fresh by tests + local guard PASS |

## 2. Regressions

**None found.** No reconciliation was executed and no tracked/untracked source file differs from session-start state (hash evidence: MERGE_HARDEN_WORK_PRESERVATION.md §2–3). The entire 667-test suite + 5-supplement passed fresh, which additionally covers auth/RLS/migration/booking/calendar/WhatsApp invariants at commit-code level.

## 3. DEXYBOR future-capability truth table

Per master prompt §11, capabilities that belong to future Phase B/agent work are marked by **actual code evidence**, not by ambition:

| DEXYBOR capability area | Status in this repository (2026-11-07) |
|---|---|
| Agent execution engine | **NOT IMPLEMENTED** — no such module, route, or runtime exists |
| Task planning | **NOT IMPLEMENTED** |
| Tool registry | **NOT IMPLEMENTED** |
| Tool permissions | **NOT IMPLEMENTED** |
| Persistent memory (agent-grade) | **NOT IMPLEMENTED** — only bounded recent-turn compliance memory inside the draft pipeline (test: "AI draft receives prior conversation turns as bounded recent memory"); not an agent memory system |
| Browser runtime | **NOT IMPLEMENTED** |
| Computer-use runtime | **NOT IMPLEMENTED** |
| Long-running workflows | **NOT IMPLEMENTED** |
| Execution verification | **NOT IMPLEMENTED** (project has *evidence guards* for onboarding/activation, which must not be renamed into agent verification) |
| Model routing | **NOT IMPLEMENTED** — only a mock/default provider switch (`AI_PROVIDER=mock`, openAI provider offline; real key absent) |
| Independent inference infrastructure | **NOT IMPLEMENTED** |

The **existing AI assistant functionality** runs locally with the safest provider (`AI_PROVIDER=mock`), produces deterministic offline outputs (offline-safety-evals suite passes), and never calls external AI or messaging services. No DEXYBOR architecture experiments were mixed in by this op.

## 4. Boundary with next operation

No Phase B capability was started, and none may be started until (a) OD-01 signed, (b) the integration & dependency cycle is owner-authorized and executed (MH-D), (c) release gates reviewed (MH-J report). This op did not implement any of the table rows above and must not be cited as "agent capabilities ready".

## 5. Architecture health notes (owner-visible, no action taken)

- Six-tree guard duplication: lint warnings duplicated inside `.codex-worktrees\pr219-reconcile` copies — lint does not distinguish worktree copies from tracked sources in its output; cosmetic, note only.
- OneDrive dependency: builds/hydro hydration sensitive to OneDrive client presence (documented Phase A root-cause; fresh run clean while client running).
- Docs-truth enforcement (`operationalDocsTruth.test.ts`, `check:documented-count`) keeps operational claims honest at HEAD — incoming #217 touches those docs; integration must keep that test green (MH-D conflict table).
