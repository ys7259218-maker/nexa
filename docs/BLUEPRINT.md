# Nexa — Project Blueprint (Scope, Progress, Remaining)

> Living document. Target: honest, shipping, user-approved "AI employee" workspace with a
> locked-down WhatsApp traffic pipeline. Every surface is real — no phantom features.
>
> **Branch**: `main` @ `a49e958` (2026-09-07). All 15 PRs prior to this cycle merged; an
> additional 27 PRs (#122–#148) merged this cycle. CI green.

---

## 1. Overall Progress — two honest lenses

Code-side readiness and global (live) readiness are **not the same number**. Every feature row
below is code-complete and CI-green, but almost nothing has touched a real live account yet.

| Scope | Code | Live evidence |
|---|---|---|
| Platform foundation (auth, tenancy, DB, middleware) | Done | Partial (preview deploy; real tenants unverified) |
| AI employee lifecycle + settings + sandbox | Done | None live |
| Dashboard + analytics + delivery funnel | Done | None live |
| Notifications / activity / search | Done | None live |
| Team / roles / audit / issue reports | Done | None live |
| WhatsApp inbound pipeline (webhook → ingest → drafts) | Done | None live (no real WABA) |
| WhatsApp outbound (approve-and-send, retry, status) | Done | None live (no real Meta send) |
| Conversation triage + pending-approvals work queue | Done | None live |
| Readiness + operations surfaces (in/out, ledger, funnel) | Done | None live |
| WhatsApp templates (outside window + explicit send anytime) | Done | None live |
| Knowledge v0 + source registry | Remaining (gated) | — |

**Overall project**: code ~92% (CI-green, offline-tested); **global readiness ~45%** —
the entire live side (real Supabase migrations + RLS evidence, Meta WABA round-trip,
OpenAI key, monitoring/backup restore drill) is blocked on the owner&apos;s accounts and
cannot be advanced from CI alone.

---

## 2. Product Menu — item by item

| # | Menu feature | State | PRs |
|---|---|---|---|
| 1 | AI Employees (list/detail/settings/voice/general) | ✅ Done | earlier |
| 2 | Knowledge (v0 entries) | 🟡 Usable, env-gated release pending | earlier |
| 3 | Employee versions history | 🟡 Gated | earlier |
| 4 | Knowledge source registry | 🟡 Gated v1.1 | earlier |
| 5 | Training sandbox (test conversations) | ✅ Done | earlier |
| 6 | Dashboard cache + analytics cards | ✅ Done | #99–#105 |
| 7 | Recent calls/appointments latest-first | ✅ Done | #99, #109 |
| 8 | Team roles & audit trail | ✅ Done | earlier |
| 9 | Issue reporting (privacy-safe, deletable) | ✅ Done | earlier |
| 10 | **Global search** | ✅ Done | #111 |
| 11 | **Notifications** | ✅ Done | #112 |
| 12 | **WhatsApp traffic (inbound → drafts → approve-and-send)** | ✅ Done | #113–#115 |
| 13 | Outbound bubble status (sent/delivered/read/failed) + retry | ✅ Done | #122–#126 |
| 14 | Outbound & inbound readiness pages + webhook ledger | ✅ Done | #131–#132 |
| 15 | Outbound history + delivery funnel | ✅ Done | #133–#134 |
| 16 | Dashboard delivery-rate stat | ✅ Done | #136 |
| 17 | Conversation triage + pending-approvals queue | ✅ Done | #130, #135 |
| 18 | WhatsApp template messages (window-closed + explicit anytime) | ✅ Done | #140 |
| 19 | Failed-sends retry queue (`/failed-sends`) | ✅ Done | #143 |
| 20 | **Meta failure reasons** (why a send was rejected, on retry queue + inbox) | ✅ Done | #146–#147 |
| — | Speed/polish sweep (12 items) | ✅ Done | #99–#110 |

---

## 3. WhatsApp pipeline — done vs remaining

### Done (code, CI green)
1. **Inbound** — signature-verified webhook (`app/api/whatsapp/webhook`), 1MB cap, queued
   `webhook_events`, dedupe, opt-out keyword, channel assignment, safety gates, **AI drafting
   only** (`draft_blocked`).
2. **Conversation inbox** — RLS reads, safety indicators (`ai`/`human`/opt-out/takeover),
   "Why no draft?" reasons, recalled-turns memory per draft, triage filters
   (All / Draft pending / Safety flagged).
3. **Outbound approve-and-send** — `sendApprovedDraft` (ownership + opt-out + takeover +
   E.164 + window checks, fail-closed), `/api/outbound/draft`, `DraftSendButton`,
   centralized `Pending approvals` queue.
4. **24h customer-service window** — enforced server-side; surfaced on draft bubbles.
5. **Status persistence** — `sent`/`sent_at`/wamid after real acceptance; Meta `delivered/read`
   events update rows by wamid; failed sends are retryable in-window.
6. **Failed-sends retry queue** — centralized `/failed-sends` page listing failed outbound
   messages newest-first with the same window semantics as the inbox; only window-open
   free-form sends are resubmittable (template sends need a fresh approval); never auto-sends;
   batch "Retry all" re-verifies ownership/window per message (`#145`).
7. **Failure reasons** — Meta status receipts carry an `errors[]` block; `processStatusEvent`
   records a bounded (1–400 char) `failure_reason` when a receipt is `failed` (delivered/read
   never stamp it), surfaced on both the retry queue and the conversation inbox (`#146–#147`).
8. **Observability** — inbound/outbound readiness pages (secret-free), webhook ledger with
   status filters, outbound history, delivery funnel, dashboard delivery-rate stat.
9. **Template messages** — operator can approve a pre-approved Meta template (name/language/
   params) either after the 24h window closes **or explicitly anytime** via `preferTemplate`;
   template reference is recorded (`template_name`) and audit-logged.
10. **Bounded scans** — the failed-sends queue caps its list (200) and filters the inbound scan
    to the last 24h (older inbound can never open a window); the batch retry scans up to a
    separate 1,000 cap so Retry All always sees the complete retryable set (`#148`).
11. **Compliance opt-out is unconditional** — a customer asking to stop is durably recorded and
    blocks AI drafts regardless of `CONVERSATION_SAFETY_ENABLED`; the flag now gates only the
    remaining safety UI (human takeover / automation mode).

### Remaining (0% but scoped)
| Item | What it needs | Value |
|---|---|---|
| **Live round-trip evidence** | Owner creds — real WABA send/receipt/opt-out test against `supabase/` migrations | Proves the whole pipeline |

### Explicitly out of scope (correctness)
- 24h window for **free-form** replies (done as refusal).
- No background/auto-send anywhere — a human approving is the only trigger.

---

## 4. Knowledge features — gated (needs infra before enabling)

| Feature | Current | Needed to enable |
|---|---|---|
| Structured Knowledge v0 (`KNOWLEDGE_V0_ENABLED`) | Read/CRUD built, RLS-verified, **env-gated off** | Migration + RLS gate check pass; then flip flag |
| Version history (`employee_versions`) | Migration + RLS **gated off** | Migration/RLS gate pass + flag |
| Knowledge Source Registry v1.1 | v1.1 migrations + role/RLS checks, **gated off** | Dedicated role/RLS pass + flag |

These are deliberate fail-closed gates, not forgotten work. Enabling = real DB + RLS work.

---

## 5. Quality gates (all green now)

- `npm run check` = eslint + tsc + **386 node tests** + 4 issue-report tests + production build.
- Contract tests pin UI/model/migration behavior (`lib/uiContracts.test.ts`, `draftSender` unit tests, migration-chain test).
- Test-suite integrity: `npm test` enumerates its files explicitly; the `outboundHistory` and `failedSends` suites were being written but not executed until #143 registered them and fixed their query-builder mocks.
- CI: `Lint, typecheck, test, and build` (incl. browser smoke) + Vercel deploy.
- Security: env-gated secrets, service-role only in guarded routes w/ code-level ownership re-checks, RLS everywhere for reads, no secrets logged, request size caps, CSRF-clean forms.

---

## 6. Suggested next roadmap (priority order)

1. **Go live with the owner** — apply `supabase/migrations/` to the real project, wire Meta
   WABA + verify token + OpenAI key + Sentry DSN, run a real customer-service-window send, and
   record opt-out/stop handling. This converts global-readiness from ~45% toward ~90%.
2. **Enable Knowledge v0 + registry** — do the migration/RLS infra work the gates are waiting on. *(High effort, real infra)*
3. **Production hardening** — backup restore drill, monitoring/alert routing, incident runbook execution. *(Prerequisite for any production-readiness claim.)*

---

*Every PR this cycle: created → local check green → pushed → CI gate → merged → main synced → reported.*