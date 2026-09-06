# Nexa — Project Blueprint (Scope, Progress, Remaining)

> Living document. Target: honest, shipping, user-approved "AI employee" workspace with a
> locked-down WhatsApp traffic pipeline. Every surface is real — no phantom features.
>
> **Branch**: `main` @ `cf70cdc` (2026-09-06). All 15 PRs merged. CI green.

---

## 1. Overall Progress

| Scope | Status | % |
|---|---|---|
| Platform foundation (auth, tenancy, DB, middleware) | **Done** | 100% |
| AI employee lifecycle + settings + sandbox | **Done** | 100% |
| Knowledge tools (entry CRUD; registry) | **Done** (gates pending) | 90% |
| Dashboard + analytics + activity | **Done** | 100% |
| Global search | **Done** | 100% |
| Notification center | **Done** | 100% |
| Team / roles / audit / issue reports | **Done** | 100% |
| **WhatsApp inbound pipeline** (webhook → ingest → drafts) | **Done** | 100% |
| **WhatsApp outbound** (approve-and-send, 24h window) | **Done** | 100% |
| WhatsApp templates (outside window) | **Remaining** | 0% |
| Privacy/A11y performance polish pass | **Done** | 100% |
| **Overall project** | — | **~92%** |

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
| — | Speed/polish sweep (12 items) | ✅ Done | #99–#110 |
| 13 | WhatsApp template messages (window-closed path) | ❌ **Not started** | — |

---

## 3. WhatsApp pipeline — done vs remaining

### Done (100%)
1. **Inbound** — signature-verified webhook (`app/api/whatsapp/webhook`), 1MB cap, queued
   `webhook_events`, dedupe, opt-out keyword, channel assignment, safety gates, **AI drafting
   only** (`draft_blocked`).
2. **Conversation inbox** — RLS reads, safety indicators (`ai`/`human`/opt-out/takeover),
   "Why no draft?" reasons, recalled-turns memory per draft.
3. **Outbound approve-and-send** — `sendApprovedDraft` (ownership + opt-out + takeover +
   E.164 + window checks, fail-closed), `/api/outbound/draft`, `DraftSendButton` in UI.
4. **24h customer-service window** — enforced server-side; surfaced on draft bubbles.
5. **Status persistence** — `sent`/`sent_at`/wamid after real acceptance; Meta `delivered/read`
   events update rows by wamid.
6. **Migrations** — `messages.status='sent'` constraint, docs mirror, chain test updated.

### Remaining (0% but scoped)
| Item | What it needs | Value |
|---|---|---|
| **Template message send** | Template picker + param mapping UI; wire `sendTemplateMessage` into an approve-and-send variant | Only legal path outside 24h window |
| 24h window countdown/notification | Small UI/notification entry | Minor (nice-to-have) |

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

- `npm run check` = eslint + tsc + **310 node tests** + 4 issue-report tests + production build.
- Contract tests pin UI/model/migration behavior (`lib/uiContracts.test.ts`, `draftSender` unit tests, migration-chain test).
- CI: `Lint, typecheck, test, and build` (incl. browser smoke) + Vercel deploy.
- Security: env-gated secrets, service-role only in guarded routes w/ code-level ownership re-checks, RLS everywhere for reads, no secrets logged, request size caps, CSRF-clean forms.

---

## 6. Suggested next roadmap (priority order)

1. **Template messages** — approve-and-send variant with template name/language/params (uses existing `sendTemplateMessage`). *(Medium effort)*
2. **Enable Knowledge v0 + registry** — do the migration/RLS infra work the gates are waiting on. *(High effort, real infra)*
3. **24h window countdown in inbox** — small UI polish. *(Small)*

---

*Every PR this cycle: created → local check green → pushed → CI gate → merged → main synced → reported.*