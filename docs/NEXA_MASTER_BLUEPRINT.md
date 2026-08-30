# Nexa master blueprint

Status: living product and engineering plan  
North star: build a trustworthy, globally useful AI Business OS that helps a business owner configure AI employees, handle communication, and automate work while retaining control of data and actions.

This blueprint operates under `docs/NEXA_VISION_AND_SAFETY.md`. The safety contract wins if any roadmap item conflicts with it. Development always continues from this repository; Nexa is not rebuilt from scratch.

Execution ownership is defined in `docs/NEXA_DEVELOPMENT_TEAM.md`: Codex is the sole controller and reviewer. The former CEO-plus-six-agent structure is retired; approved apps may receive only bounded, secret-free helper packets.

## Current status map (29 August 2026)

Legend:

- ✅ Complete in the repository and validated
- ⚠️ Partial, configured elsewhere, or externally blocked
- ❌ Not built yet

### Foundation and safety

| Capability | Status | Reality |
| --- | --- | --- |
| Existing GitHub repository preserved | ✅ | Development continues from the same `main` branch; no rebuild |
| Master vision and safety contract | ✅ | Permanent rules documented and linked in the handoff |
| Master product/engineering blueprint | ✅ | Product, architecture, phases, gates, and measures documented here |
| Dark premium Nexa design foundation | ✅ | Existing visual direction preserved across current surfaces |
| Environment placeholder documentation | ✅ | `.env.example` contains placeholders; real secrets stay uncommitted |
| Lint, typecheck, unit-test, and build gates | ✅ | Latest integrated `main` passes 144 unit/static tests and the production build |
| Dependency vulnerability audit | ✅ | Latest `npm audit` reports zero known vulnerabilities |
| Security headers and API no-store policy | ✅ | Global browser protections and API cache controls have tests |
| Secret-free browser smoke baseline | ✅ | One Chromium project verifies health privacy, login availability, and the unauthenticated fail-closed boundary on a built local app; authenticated/RLS/production coverage remains separate |
| Authenticated-shell accessibility baseline | ⚠️ | Skip navigation, named landmarks/navigation, visible focus, reduced-motion CSS, and static contracts are implemented; route-by-route keyboard, zoom, screen-reader, contrast, touch-target, and responsive audits remain |
| Public auth-form accessibility baseline | ⚠️ | Login, signup, recovery, and password reset have visible labels, busy semantics, focused live feedback, and narrow-screen cards; assistive-technology and browser/device audits remain |
| Create-employee form feedback baseline | ⚠️ | The authenticated create form has visible labels, bounded inputs, pending semantics, and focused inline feedback; the remaining settings forms still require the same audit |
| General Settings feedback baseline | ⚠️ | Identity/business settings have labeled bounded inputs, pending semantics, focused inline feedback, and retained delete confirmation; other settings cards remain |
| Metadata settings feedback baseline | ⚠️ | Voice, phone, and legacy knowledge-reference cards have labeled bounded inputs and focused inline feedback while preserving honest no-runtime/no-ingestion copy |
| WhatsApp Setup feedback baseline | ⚠️ | Channel linking and assignment have labeled bounded inputs, pending semantics, and focused inline feedback; Meta registration and outbound remain disabled |
| Knowledge Source Registry feedback baseline | ⚠️ | Metadata-only source creation/review/deletion has associated bounded controls, pending semantics, and focused feedback; no content ingestion or AI use exists |
| Structured Knowledge feedback baseline | ⚠️ | Note/FAQ create, edit, verify, and delete controls have associated bounded fields, pending semantics, and focused feedback; verified-only runtime use remains rollout-gated |
| Employee lifecycle feedback baseline | ⚠️ | Guarded transition controls expose pending state and focused error/success feedback while retaining activation and higher-level safety gates |
| Workspace safety feedback baseline | ⚠️ | Owner/Admin pause/resume control exposes pending and focused feedback while preserving confirmation, audit, and fail-closed draft blocking |
| Production monitoring and alerting | ❌ | No complete metrics/alert/uptime pipeline yet |
| Backup restore drill and incident runbooks | ❌ | Required before a production-readiness claim |

### Identity and ownership

| Capability | Status | Reality |
| --- | --- | --- |
| Email/password signup and login | ✅ | Supabase SSR cookie sessions with server validation |
| Input/error hardening | ✅ | Bounded normalized inputs; generic provider-safe errors |
| Email-confirmation-safe signup | ✅ | No false dashboard redirect without a real session |
| Password recovery | ✅ | Safe recovery request, fixed PKCE callback, protected reset, sign-out |
| Production auth callback configuration | ⚠️ | Code and documentation are ready; exact URLs must be allowlisted and tested in Supabase |
| Server protection for current private pages | ✅ | Proxy refresh plus independent server-side user validation |
| Workspace/team tenancy | ⚠️ | Workspace foundation and guarded cutover are implemented; live migration and two-account RLS proof remain |
| Owner/Admin/Operator/Viewer roles | ⚠️ | Role management and final-owner protection are rollout-gated; invitations remain unbuilt |
| MFA and session/device management | ❌ | Planned security capability, not implemented |
| Live RLS integration proof | ⚠️ | Test scaffolding exists but needs a dedicated Supabase test project |
| Reproducible local Supabase toolchain | ⚠️ | CLI/config and guarded double-reset verifier are pinned; Docker execution has not yet run on this machine |

### AI employees

| Capability | Status | Reality |
| --- | --- | --- |
| Create, list, load, update, and delete | ✅ | Typed Supabase data layer under current RLS ownership |
| General/voice/phone/knowledge settings persistence | ✅ | Current documented settings fields save to real records |
| Honest empty/loading/error states | ✅ | No fabricated employee records or fake success state |
| Draft → Testing → Active → Paused → Archived lifecycle | ⚠️ | Lifecycle, guarded RPC transitions, and fail-closed runtime enforcement are implemented; migration rollout remains |
| Employee test sandbox | ✅ | Protected deterministic simulation is available and never sends, saves, activates, or calls an external provider |
| Version history and restore | ⚠️ | Immutable bounded snapshots, guarded restore, UI, audit, and migration are implemented; live migration and two-account proof remain |
| Activation checklist | ⚠️ | Evidence-based checklist is implemented, but Active is locked until a trusted server evidence writer and Meta outbound readiness exist |
| Employee/global kill switches | ⚠️ | Employee and workspace controls are implemented fail-closed; migration/flag rollout remains |
| Employee audit trail | ⚠️ | Client-immutable database audit history is implemented; live migration/RLS verification remains |

### AI and knowledge

| Capability | Status | Reality |
| --- | --- | --- |
| Deterministic safe mock AI | ✅ | Default provider works without paid keys |
| Optional OpenAI Responses provider | ✅ | Server-only opt-in path, bounded output, `store: false`, safe fallback |
| Prompt-injection boundary | ✅ | Business/customer content is bounded untrusted JSON with action/secret rules |
| Real OpenAI production enablement | ⚠️ | Code exists; remains intentionally opt-in until configured and evaluated |
| Knowledge settings metadata | ✅ | Website/FAQ/PDF/notes references persist |
| Structured notes and FAQs | ⚠️ | Per-employee CRUD, verified/draft state, deterministic FAQ matching, audit, and UI are implemented; migration/RLS rollout remains |
| Knowledge source registry | ⚠️ | Metadata-only public HTTPS website and PDF/TXT file references, deletion, role RLS, and content-free audit are implemented; no ingestion or AI use; rollout remains |
| File upload and website ingestion | ❌ | No secure parser, storage, chunking, or ingestion worker yet |
| Retrieval with source evidence | ❌ | No embeddings/retrieval/citation pipeline yet |
| Knowledge versioning, freshness, deletion proof | ❌ | Required for trustworthy production answers |
| Maintained AI evaluation suite | ⚠️ | Safety-focused unit tests exist; full multilingual/quality eval set does not |

### WhatsApp and conversations

| Capability | Status | Reality |
| --- | --- | --- |
| Meta webhook verification and signature validation | ✅ | Signed endpoint rejects invalid events |
| Request-size protection | ✅ | One MiB declared and streamed byte limit |
| Durable idempotent inbound processing | ✅ | Ledger claim, deduplication, owner resolution, message storage, retry boundary |
| Owner-scoped conversation inbox | ✅ | Real histories, masked identifiers, honest states |
| Delivered/read/failed receipt handling | ✅ | Owner-scoped monotonic status updates with deduplication |
| Draft AI replies | ✅ | Replies are stored as `draft_blocked`; they are not falsely sent |
| Meta phone registration | ⚠️ | External Meta status remains Pending/Not registered |
| Real outbound WhatsApp sending | ❌ | Intentionally disabled behind `WHATSAPP_OUTBOUND_ENABLED=false` |
| Explicit channel-to-employee routing | ⚠️ | Composite workspace-bound assignment, UI, audit, and fail-closed runtime are implemented; migration and live multi-account proof remain |
| Controlled known-number outbound test | ❌ | Must happen only after Meta registration succeeds |
| Human takeover and opt-out workflow | ⚠️ | Role-guarded takeover, exact-keyword durable opt-out, audit, UI, and fail-closed runtime are implemented; migration and live multi-account proof remain |
| Queue/worker processing | ❌ | Webhook work is currently inline after durable verification/claim boundaries |

### Business operations and global platform

| Capability | Status | Reality |
| --- | --- | --- |
| Dashboard on real database tables | ✅ | Honest zero/empty states; no fabricated metrics |
| Calls and appointment producers | ❌ | Tables exist but no telephony/booking runtime writes them |
| Lead capture and approval inbox | ❌ | Planned Phase 4 capability |
| Calendar, CRM, payments, and order tools | ❌ | No consequential-action tool framework yet |
| Idempotent action state machine | ❌ | Required before business actions can be automated |
| Multilingual/localized product | ❌ | Global localization, RTL, locale, and human QA not built |
| Billing and usage limits | ❌ | Must follow reliable value, usage metering, and transparent cost controls |
| Public API/integration marketplace | ❌ | Planned after core product and tenant controls mature |
| Enterprise SSO/SCIM/advanced controls | ❌ | Long-term Phase 6 scope |

### Exact position

Nexa has completed **Phase 0's code foundation**, but Phase 0 is not fully closed operationally. Dedicated live RLS testing, production callback testing, monitoring, and recovery operations remain. Phase 1 is implemented in code through workspace cutover, roles, lifecycle, activation evidence, audit history, and kill switches, but it is not complete until the migrations and multi-account security checks pass in a dedicated Supabase environment.

```text
Phase 0  Stable foundation          ⚠️ Code foundation complete; operational gates remain
Phase 1  Workspace + lifecycle      ⚠️ Code ready; database rollout and isolation proof pending
Phase 2  Knowledge system           ❌ Not started
Phase 3  WhatsApp production        ⚠️ Inbound foundation complete; Meta/outbound blocked
Phase 4  Business actions           ❌ Not started
Phase 5  Global product/platform    ❌ Not started
Phase 6  Ecosystem and scale        ❌ Not started
```

### Next execution checkpoint

1. Apply the Phase 1 migrations in order to a dedicated test Supabase project and run two-account role/RLS/bypass tests.
2. Verify production auth callbacks, monitoring, backup restore, and incident basics before a production-readiness claim.
3. Apply and verify the employee-version migration in a dedicated test project, then enable its fail-closed rollout flag.
4. Apply and verify Knowledge v0 and explicit WhatsApp channel assignment, then continue with secure ingestion/retrieval foundations.
5. Keep Meta registration as a parallel external task; outbound remains off until every Phase 3 gate passes.

## 1. Product promise

Nexa should let a business owner move through one clear loop:

1. Create an account and business workspace.
2. Configure an AI employee for a specific role.
3. Connect an approved communication channel.
4. Give the employee verified business knowledge and action permissions.
5. Review conversations, approvals, outcomes, and performance.
6. Improve the employee without losing history, ownership, or control.

Nexa must never pretend that an integration, employee, message, booking, payment, or metric is active when it is not. Empty, pending, blocked, and failed are valid product states.

## 2. Product pillars

### AI employees

Each employee has a role, instructions, language, voice, knowledge, channel assignments, working hours, escalation rules, allowed actions, and a visible lifecycle: Draft → Testing → Active → Paused → Archived.

### Unified conversations

WhatsApp is the first channel. Email, web chat, SMS, and voice may follow through the same channel-neutral conversation model. Owners can inspect history, identify AI/human messages, take over, and see delivery or failure state.

### Business knowledge

Owners add verified facts, FAQs, policies, products, services, hours, and documents. Knowledge must be versioned, source-attributed, scoped per workspace/employee, and removable. The AI must say when information is missing.

### Controlled actions

Bookings, leads, orders, payments, CRM updates, and outbound messages use explicit tools with narrow permissions. Read actions and reversible drafts come before consequential writes. High-impact actions require owner approval until evidence supports safer automation.

### Operations and insight

The dashboard reports real data only: demand, response times, resolution, handoffs, failed actions, appointments, and channel health. Every metric must have a defined source and time boundary.

## 3. Experience blueprint

### Public experience

- Premium dark Nexa identity, fast landing experience, clear value, honest product state.
- Preview onboarding may demonstrate configuration but does not claim deployment or retain sensitive data.
- Legal, privacy, deletion, and security information remains accessible before signup.

### Owner workspace

- Overview: real operational health, pending approvals, urgent failures, recent outcomes.
- AI Employees: create, test, configure, activate, pause, archive, and inspect version history.
- Inbox: conversations, filters, human takeover, internal notes, assignment, and safe reply drafting.
- Knowledge: sources, freshness, conflicts, employee access, ingestion state, and deletion.
- Automations: triggers, allowed tools, approvals, limits, audit history, and kill switch.
- Integrations: connection status, permissions, expiry, errors, test mode, and disconnect.
- Settings: members, roles, billing, retention, exports, deletion, security, and audit log.

### Human-control rules

- A global workspace kill switch pauses automated outbound actions.
- Each employee and integration has its own pause control.
- Human takeover immediately stops automated replies for that conversation.
- Consequential actions expose what will happen before approval.
- Owners can see why a reply/action happened using safe evidence references, without exposing hidden prompts or secrets.

## 4. Technical blueprint

```text
Browser / mobile web
        |
Next.js application boundary
  |-- authenticated owner UI
  |-- public/legal/onboarding UI
  |-- signed provider webhooks
  |-- internal fail-closed operations
        |
Application services
  |-- identity and workspace authorization
  |-- AI employee configuration
  |-- conversations and channel adapters
  |-- knowledge retrieval
  |-- policy, approval, and tool execution
  |-- audit, metrics, and notifications
        |
Supabase
  |-- Postgres + RLS ownership boundary
  |-- Auth cookie sessions
  |-- Storage for approved knowledge files
  |-- queues/worker boundary when introduced
        |
External providers
  |-- Meta WhatsApp
  |-- AI provider(s)
  |-- future email/voice/calendar/CRM adapters
```

### Architectural rules

- Multi-tenancy is workspace-based and enforced in Postgres RLS. A user ID alone is not the long-term tenancy model.
- Browser clients use publishable credentials only. Provider secrets and elevated database credentials stay in isolated server modules.
- External events enter through signature-checked, size-bounded, idempotent adapters and a durable ledger.
- Channel, AI, and tool providers sit behind interfaces so one vendor cannot own the product core.
- Slow or retryable webhook work moves to a queue/worker; webhooks acknowledge only after a durable claim.
- Schema changes are additive, reviewed, documented, reversible where practical, and tested against RLS.
- Logs use request/correlation IDs and safe aggregates, never secrets, raw customer payloads, or full identifiers.

## 5. Core domain model

Long-term entities:

- `workspaces`, `workspace_members`, `roles`, `invitations`
- `ai_employees`, `ai_employee_versions`, `employee_channel_assignments`
- `knowledge_sources`, `knowledge_documents`, `knowledge_chunks`, `knowledge_versions`
- `channels`, `conversations`, `conversation_participants`, `messages`, `handoffs`
- `tools`, `tool_permissions`, `action_requests`, `action_runs`, `approvals`
- `contacts`, `leads`, `appointments`, `calls`
- `activity_events`, `audit_events`, `webhook_events`, `usage_events`
- `plans`, `subscriptions`, `usage_limits`

Customer content, operational metadata, credentials, and audit/security data must have separate access and retention rules.

## 6. AI safety and quality blueprint

Every AI turn follows this boundary:

1. Authenticate workspace, channel, conversation, and employee ownership.
2. Classify input and detect unsupported or high-risk requests.
3. Retrieve only authorized, current knowledge with source identifiers.
4. Apply employee policy and allowed-action limits.
5. Generate a bounded draft; treat all retrieved/customer text as untrusted data.
6. Validate output for secrets, unsupported claims, prohibited actions, and size.
7. Request approval or human handoff when policy requires it.
8. Store the result and safe decision metadata; execute only idempotent approved tools.
9. Measure outcome, failure, correction, escalation, and latency.

Required evaluation sets include prompt injection, cross-tenant access, unknown business facts, abusive content, multilingual requests, action spoofing, duplicate events, provider timeout, and partial failure. No new model/provider becomes production default without offline evaluation, controlled rollout, rollback, cost limits, and privacy review.

## 7. Security and reliability blueprint

- Authentication: verified sessions, safe recovery, abuse/rate controls, optional MFA, session/device management.
- Authorization: workspace RBAC plus RLS; privileged operations independently re-check authorization server-side.
- Secrets: managed environment storage, rotation procedure, least privilege, no secrets in Git/client/logs.
- Data: encryption in transit/at rest, retention controls, export/deletion workflow, backups and restore drills.
- Application: bounded validation, CSRF-safe patterns, strict redirect allowlists, security headers, dependency and secret scanning.
- Integrations: signature verification, replay protection, idempotency keys, timeouts, circuit breakers, token expiry monitoring.
- Operations: structured safe logs, health metrics, alerts, incident severity/runbooks, status communication, audit trail.
- Delivery: protected main branch, reviewed migrations, preview environment, staged rollout, rollback plan, post-deploy smoke test.

Security is defence in depth, not a claim that the product is impossible to break.

## 8. Delivery roadmap

### Phase 0 — Stable foundation (current)

Delivered: Supabase SSR auth, owner-scoped AI employee CRUD/settings, honest dashboard states, signed/idempotent WhatsApp inbound storage, inbox, mock/optional OpenAI drafting, delivery receipts, recovery endpoint, security headers, request-size limits, prompt-injection boundaries, safe signup and account recovery.

Exit gaps:

- Run real RLS integration suites in a dedicated test Supabase project.
- Configure and test production authentication callback URLs.
- Add production monitoring, backup verification, and incident runbooks.
- Resolve Meta registration externally; keep outbound disabled until controlled verification passes.

### Phase 1 — Workspace and trustworthy employee lifecycle

- Introduce workspaces, members, Owner/Admin/Operator/Viewer roles, invites, and RLS migration.
- Add Draft/Testing/Active/Paused/Archived lifecycle and test sandbox.
- Add employee instruction/version history, restore, activation checklist, and global/per-employee kill switches.
- Replace remaining decorative UI controls with real, validated state or remove them.

Exit criteria: two test accounts cannot read/write across workspaces; every activation requirement is visible; pause takes effect immediately; all critical changes appear in audit history.

### Phase 2 — Knowledge system

- Secure file upload and website/FAQ ingestion with type/size limits and malware-aware handling.
- Parsing, chunking, embeddings, source/version metadata, deletion, retention, and freshness warnings.
- Employee-level knowledge permissions, citations in internal review, conflict handling, and “I do not know” behavior.

Exit criteria: retrieval quality passes a maintained evaluation set; deleted knowledge is no longer retrievable; unsupported-answer and cross-workspace tests pass.

### Phase 3 — WhatsApp production channel

Entry gate: Meta number registration is active, production callback is verified, privacy disclosures are current, and test workspace/channel mapping is correct.

- Implement outbound adapter behind `WHATSAPP_OUTBOUND_ENABLED` with idempotency, template/session-window rules, rate limits, retry/backoff, and cost controls.
- Add human takeover, reply approval, opt-out handling, channel health, token expiry alerting, and safe operational replay.
- Controlled rollout: known-good number → internal workspace → small pilot → monitored production.

Exit criteria: duplicate sends are prevented; opt-outs stop sends; delivery states reconcile; kill switches work; rollback to inbound-only is tested.

### Phase 4 — Actions and business outcomes

- Build permissioned tool framework and approval inbox.
- Start with lead capture and appointment requests; then calendar/CRM adapters.
- Add idempotent action state machine: Proposed → Approved → Executing → Succeeded/Failed/Cancelled.
- Add compensation/recovery behavior for partial failures.

Exit criteria: no tool can exceed its declared permission; repeated requests do not duplicate actions; owners can audit, cancel, and understand every action.

### Phase 5 — Global product and platform

- Localization framework, Unicode/RTL support, locale/timezone-aware formatting, multilingual evaluations.
- Regional privacy/retention configuration and data-location review before regional promises.
- Accessibility audit, mobile-responsive owner workflow, performance budgets, scalable worker architecture.
- Usage metering, fair limits, billing only after reliable value and transparent cost reporting.

Exit criteria: target locales pass human QA; timezone/locale metrics are correct; accessibility and performance budgets pass; billing matches auditable usage.

### Phase 6 — Ecosystem and scale

- Versioned public API, scoped OAuth, webhooks, SDK, integration marketplace, developer sandbox.
- Enterprise controls: SSO/SAML, SCIM, advanced RBAC, configurable retention, audit export, regional controls.
- Reliability targets, capacity tests, disaster-recovery exercises, vendor failover where justified.

Exit criteria: published compatibility/security policy, tenant-isolation tests, recovery objectives verified, and partner integrations cannot bypass policy controls.

## 9. Success measures

Product quality:

- Time from signup to a correctly configured test employee.
- Percentage of employees passing activation checklist.
- Owner correction, handoff, and unresolved-request rates.
- Verified resolution and action-success rates—not model-generated claims.

Trust and safety:

- Cross-tenant access incidents: target zero.
- Unauthorized consequential actions: target zero.
- Secret/customer-data exposure incidents: target zero.
- Opt-out enforcement, deletion completion, restore-test success, and critical patch time.

Reliability and cost:

- Webhook durable-claim success, duplicate-send rate, queue age, provider error rate, p95 response time.
- AI and channel cost per resolved outcome, with workspace limits and anomaly alerts.

## 10. Release gates

Nothing is called production-ready until:

- Employee version restore provides accessible pending and focused result feedback while stating which safety fields remain unchanged (`docs/VERSION_RESTORE_FEEDBACK_V1.md`).
- Conversation takeover controls provide accessible pending, success, and failure feedback without overstating AI eligibility (`docs/CONVERSATION_SAFETY_FEEDBACK_V1.md`).
- Team role controls provide accessible pending, success, and failure feedback while preserving the database-enforced final-Owner and role boundaries (`docs/TEAM_SETTINGS_FEEDBACK_V1.md`).
- Product behavior is honest and critical states have loading/empty/error/retry handling.
- Authentication, authorization, RLS, validation, idempotency, privacy, and failure behavior are reviewed.
- Lint, typecheck, unit tests, production build, RLS integration tests, dependency audit, secret scan, and diff inspection pass.
- Migrations, environment variables, provider setup, monitoring, backup, rollback, and operator steps are documented.
- A controlled smoke test passes without using real customer data.
- Feature flags default safe, and the owner can stop the feature quickly.

## 11. Immediate execution order

1. Create a dedicated Supabase test project and run the existing RLS integration suite.
2. Configure production/local authentication callback allowlists and test signup/recovery end to end.
3. Add workspace tenancy and RBAC design/migration with backward-compatible ownership mapping.
4. Add employee lifecycle, activation checklist, test mode, and kill switches.
5. Add monitoring, audit events, backup/restore verification, and incident runbooks.
6. Build the knowledge ingestion foundation.
7. Continue Meta registration as an external track; enable outbound only through Phase 3 gates.

## 12. Decision filter

Before adding a feature, answer:

1. Which real user problem does it solve?
2. What data and permission does it require?
3. Can it create a message, money movement, booking, order, or other consequence?
4. What happens when input, AI, database, or provider fails?
5. How is it tested, monitored, stopped, rolled back, and deleted?
6. Does it strengthen Nexa's shared platform or create an isolated demo?

If these answers are unclear, the feature stays in design or test mode.
