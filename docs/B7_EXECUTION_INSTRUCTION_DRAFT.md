# B7 EXECUTION INSTRUCTION — DRAFT FOR OWNER AUTHORIZATION (BROWSER INTEGRATION)

> ## DRAFT — NOT SIGNED — NOT AUTHORIZATION
> This document is a **preparation artifact only**. It grants nothing until the accountable owner signs Section L after reviewing every section. Until signed by the owner and acknowledged by the technical execution operator, it is a proposal with blank decision fields. A chat message, verbal statement, or agent-prepared text does **not** count as this instruction. **No B7 code, browser runtime, dependency, migration or external call has been made.**

**Draft prepared:** 2026-11-16 (operator — technical execution only, NOT an owner and NOT an approver)
**Repository:** `C:\Users\Asus\nexa` (remote: `https://github.com/ys7259218-maker/nexa.git`)
**Current branch:** `main` @ `ed33974` (verify against live `git status` before execution)
**Origin/main at preparation:** `f6694d2` (`docs: pin the B6 merge commit and document hash line endings (#239)`)
**Governing status:** Phase B1–B6 complete and merged. B7 **NOT STARTED**. No browser runtime is present in `lib/agent/`.

---

## 0. Gate prerequisites (must exist before this instruction is usable)

| Prerequisite | Where it is decided | Status at preparation |
|---|---|---|
| **OD-B10** — computer-use stays deferred; B7 is browser-only | `docs/DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md` owner box | `PENDING OWNER DECISION` |
| **OD-B4** — Playwright runtime browsers + browser service hosting (staged A→B) | same matrix, owner box | `PENDING OWNER DECISION` |
| **This instruction** — owner-signed B7 scope | Sections A–M below | `DRAFT — NOT SIGNED` |
| **B7 push/PR authorization** | separate instrument, prepared only after a branch exists | `NOT PREPARED` |

Execution may not begin while any row is pending. The operator stops at this gate and reports; it does not install browsers, add dependencies, or write browser code on the strength of a chat message.

---

## A. Instruction identity (owner completes — all blank)

| Field | Owner entry |
|---|---|
| Full legal name (as on OD-01 signature) | ______________________________ |
| Role / authority | ______________________________ |
| Instruction issue date & time | ______________________________ |
| Timezone | ______________________________ |
| Internal reference / ticket (optional) | ______________________________ |

---

## B. Approved repository & branches (facts prefilled from reports; owner must confirm or correct)

| Item | Value | Owner confirm/correct |
|---|---|---|
| Repository (local) | `C:\Users\Asus\nexa` | `[ ]` Correct `[ ]` Correct to: ______________ |
| Repository (remote) | `https://github.com/ys7259218-maker/nexa.git` | `[ ]` Correct `[ ]` Correct to: ______________ |
| Current branch | `main` @ `ed33974` | `[ ]` Correct `[ ]` Correct to: ______________ |
| Source branch (candidate — owner MUST name) | ______________________________ | `[ ]` Named knowingly `[ ]` UNVERIFIED |
| Destination branch (candidate — owner MUST name; never `main` unless explicitly written) | ______________________________ | `[ ]` Named knowingly `[ ]` UNVERIFIED |

---

## C. Approved implementation scope — B7 Browser Integration

Per `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §G and the B7 milestone row, the following scope is **proposed** for owner approval. Each item is **PENDING OWNER APPROVAL** until explicitly checked. Everything is additive, offline by default, and dormant behind a flag.

### C1. Browser service boundary (no runtime browser by default)

| Item | Description | Owner decision |
|---|---|---|
| C1a | New `lib/agent/browser/` module exposing a `BrowserService` interface (open session → act → capture evidence → close) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C1b | `mock` driver is the default: deterministic, offline, launches no real browser | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C1c | `playwright` driver is written against the same interface but does nothing unless `BROWSER_DRIVER=playwright` **and** binaries are installed under a separate OD-B4 decision | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C1d | No credential autofill, no reuse of the operator's or a user's real browser profile, no persistent cookies across sessions | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C2. Session policy engine (default deny)

| Item | Description | Owner decision |
|---|---|---|
| C2a | Per-session policy = (deny by default) + tenant allow-list; a URL not on the list is refused before any navigation | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C2b | Scheme/host/port normalisation and punycode checks so a look-alike domain cannot pass the allow-list | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C2c | Policy snapshot hash recorded with the session so the effective rules are auditable | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C2d | Allow-list entries are runtime configuration owned by the tenant, not hard-coded | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C3. Evidence capture

| Item | Description | Owner decision |
|---|---|---|
| C3a | Before/after evidence descriptor per side-effecting action: URL, timestamp, screenshot hash, DOM snapshot hash | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C3b | Evidence bytes go only to workspace-scoped sandbox storage; the database stores descriptors/pointers, never page content | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C3c | Evidence is append-only and deleted by the same cascades as its task | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C4. Approval-gated interactions

| Item | Description | Owner decision |
|---|---|---|
| C4a | Read-only inspection (navigate, screenshot, DOM read) may run inside the policy | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C4b | Any side-effecting action (form submit, button with side effects, upload, download) requires a per-action approval through the existing B3 permission/approval engine | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C4c | The approval prompt shows the exact target URL and a plain-language action description before consent | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C4d | Denied, expired or missing approval fails closed — the action never runs | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C5. Session lifecycle and kill switch

| Item | Description | Owner decision |
|---|---|---|
| C5a | Hard session TTL plus idle timeout | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C5b | Teardown wipes the ephemeral profile and verifies no residual state | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C5c | Workspace kill switch aborts a live session immediately and records the reason | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C6. Tool manifests and T4 tier

| Item | Description | Owner decision |
|---|---|---|
| C6a | Add `"T4"` to the tool risk-tier union (`TOOL_RISK_TIERS`) — additive; existing T0/T1 behaviour unchanged | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C6b | Browser tool manifests (`browser.open`, `browser.inspect`, `browser.act`) registered only when `BROWSER_AGENT_ENABLED=true`; absent and unregistered otherwise | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C6c | `browser.act` is T4 and can never be auto-approved by policy; it always needs the C4 approval row | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C6d | No computer-use manifest is added; the family stays reserved and unregistered (OD-B10) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C7. Additive persistence (PROPOSED — owner may reject)

| Item | Description | Owner decision |
|---|---|---|
| C7a | One new table `agent_browser_sessions`: `workspace_id`, `task_id`, `session_ref`, `policy_hash`, `started_at`, `ended_at`, `teardown_status`, `evidence_refs` — workspace-scoped RLS, append-only, no page content | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C7b | No `ALTER` on any existing table; no existing migration file touched | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

---

## D. Explicitly excluded operations (remain prohibited unless SEPARATE WRITTEN AUTHORIZATION exists)

| Operation | Status |
|---|---|
| Computer-use / full desktop control | PROHIBITED — OD-B10 keeps it deferred; B7 is browser-only |
| External browser-API vendor (OD-B4 Option C) | PROHIBITED in B7 — would route browsing through a third party |
| Installing Playwright browser binaries | PROHIBITED until OD-B4 is signed; no `npx playwright install` |
| New npm dependencies | PROHIBITED — zero new dependencies (OD-B1); `@playwright/test` is already a dev-dependency |
| Real-tenant browsing or any external network navigation | PROHIBITED in B7 implementation; the default driver is the offline mock |
| Uploads sourced outside the tenant's approved staging area | PROHIBITED |
| Downloads written to the host filesystem | PROHIBITED — sandbox storage only |
| Production deployment / production DB / hosted migrations | PROHIBITED |
| Live OAuth, provider, WhatsApp or calendar calls | PROHIBITED |
| `npm audit fix` / `--force`, unreviewed major upgrades | PROHIBITED |

---

## E. Permitted file modifications (additive only)

| Path | Description | Owner decision |
|---|---|---|
| `lib/agent/browser/types.ts` (NEW) | Interfaces, policy and evidence types | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/sessionPolicy.ts` (NEW) | Default-deny allow-list evaluation | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/sessionPolicy.test.ts` (NEW) | Policy matrix, phish/look-alike block tests | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/evidence.ts` (NEW) | Evidence descriptors and hashing | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/evidence.test.ts` (NEW) | Descriptor and cascade tests | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/browserService.ts` (NEW) | Session lifecycle over a driver interface | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/browserService.test.ts` (NEW) | TTL, teardown, kill-switch tests | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/mockDriver.ts` (NEW) | Deterministic offline driver | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/playwrightDriver.ts` (NEW) | Playwright adapter; inert unless explicitly selected | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/approvalGate.ts` (NEW) | Bridges side-effecting actions to the B3 approval engine | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/approvalGate.test.ts` (NEW) | Submit/upload/download approval matrix | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/manifests.ts` (NEW) | Browser tool manifests, flag-gated registration | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/browser/manifests.test.ts` (NEW) | Manifest validation and absent-by-default tests | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/tools/types.ts` (MODIFIED) | Add `"T4"` to the risk-tier union only | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/agent/tools/registry.ts` (MODIFIED) | Flag-gated inclusion of browser manifests; default off | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `supabase/migrations/2026XXXXXXXXXX_agent_browser_sessions_b7.sql` (NEW) | Additive session table with workspace RLS | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `package.json` (MODIFIED) | Register the new test files in the `test` script; add no dependency | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `NEXA_HANDOFF.md`, `docs/GO_LIVE.md` (MODIFIED) | Test/migration counts and status only | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| Existing `lib/agent/tools/{executor,permissionEngine,permissionGate,permissionStore,audit,schema}.ts` | **NOT MODIFIED** — reused as-is | n/a (explicitly excluded) |
| `lib/ai/*`, `lib/whatsapp*.ts`, provider modules, existing routes | **NOT MODIFIED** | n/a (explicitly excluded) |

---

## F. Migration restrictions

| Restriction | Detail |
|---|---|
| Append-only | New migration file only; existing migration files byte-frozen |
| No production execution | Local/CI disposable replay only; never applied to a hosted project |
| No schema alteration to existing tables | Creates `agent_browser_sessions` only; no `ALTER` |
| RLS by `workspace_id` | Workspace-scoped RLS on day 1 |
| Least-privilege roles | Agent DB role grants only on the new table |
| Storage | Evidence bytes in workspace-scoped sandbox storage, not in the database |

---

## G. Dependency modification restrictions

| Restriction | Detail |
|---|---|
| Zero new dependencies | Per OD-B1; `@playwright/test` 1.64.1 is already present as a dev-dependency |
| No browser binary install | `npx playwright install` is prohibited until OD-B4 authorizes it |
| No `npm audit fix` / `--force` | Non-waivable |
| No unreviewed major upgrades | Non-waivable |
| Lockfile changes | None expected; any change requires a fresh owner row |

---

## H. Production restrictions

| Restriction | Detail |
|---|---|
| No production deployment | Vercel or any host — PROHIBITED |
| No production DB access | No hosted connections, migrations or writes |
| No production credentials | No env/secret/infrastructure changes |
| No customer-facing enablement | B7 ships dormant; `BROWSER_AGENT_ENABLED` defaults to `false` |
| Production hard-off | The existing production guard keeps browser capability off even if a flag is set |
| `PRODUCTION_RELEASE_APPROVED` guard | No B7 flag may weaken it |

---

## I. Testing and verification requirements

| Check | Command | Required |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | `[ ]` Required |
| Lint | `npm run lint` | `[ ]` Required (0 errors) |
| Unit tests | `npm test` | `[ ]` Required (all pass; new tests included) |
| Issue reports | `npm run test:issue-reports` | `[ ]` Required |
| Documented count | `npm run check:documented-count` | `[ ]` Required |
| Tracked secrets | `npm run check:tracked-secrets` | `[ ]` Required |
| Production build guard | `npm run check:production-build` | `[ ]` Required |
| Full check | `npm run check` | `[ ]` Required |
| Migration replay | `npm run verify:supabase:local` | `[ ]` Required (local disposable DB only) |
| Browser-launch tests | separate script, not in `npm test` | `[ ]` Only if OD-B4 allows; otherwise not run |

Required security tests (mock driver, no network): phish/look-alike domain block; default-deny matrix; submit/upload/download approval-required matrix; approval denial and expiry fail closed; teardown leaves no session state; kill switch aborts; browser manifests absent when the flag is off. The 37 concrete cases are listed in `docs/B7_SECURITY_TEST_MATRIX.md` (proposal; the owner may add, trim or strike cases).

---

## J. Rollback requirements

| Item | Rollback approach |
|---|---|
| Feature flag | `BROWSER_AGENT_ENABLED=false` → service never starts, manifests unregistered |
| Driver | `BROWSER_DRIVER=mock` → no real browser process |
| Code | New module only; deleting it restores prior state |
| Registry change | One flag-gated branch; revert restores exactly the current registry |
| Migration | Additive table only; rollback = do not apply |
| Kill switch | Workspace-level abort already part of scope |

---

## K. Stop conditions

| Condition | Action |
|---|---|
| OD-B10 or OD-B4 unsigned | STOP before any code — report and wait |
| This instruction unsigned or incomplete | STOP — nothing executes |
| Browser binaries missing | STOP — do not install; OD-B4 is the only path |
| Verification failure (`npm run check` red) | STOP + report + wait for owner |
| Any HEAD / `origin/main` change since signing | Fresh approval required |
| Scope conflict with OD-01 / OD-B decisions | STOP — do not proceed |
| Any need for a new dependency, real secret, hosted DB or external call | STOP — separate authorization required |
| Owner revocation (in writing, anytime) | Effective immediately |

---

## L. Owner authorization & signatures (blank — humans only)

**Repository owner / authorized decision-maker**

- Full legal name: ______________________________
- Role / authority: ______________________________
- Signature (type full name again): ______________________________
- Date & time typed: ______________________________ Timezone: ______________________________

**Technical execution acknowledgment (human accountable operator)**

- Name / role: ______________________________
- Signature: ______________________________
- Date & time typed: ______________________________ Timezone: ______________________________

---

## M. Mandatory statements

1. **This file, unsigned or incomplete, grants no permission.** The operator executes nothing on chat statements, verbal approval, intent expressions, or agent-prepared text.
2. **B7 implementation has NOT started.** No browser code, browser binary, dependency, migration or external call exists as part of this draft.
3. **All fields marked `[ ]` UNVERIFIED or PENDING OWNER APPROVAL must be completed by the owner personally.** The operator must not fill owner fields.
4. This instruction works **only together with** the signed OD-B10 and OD-B4 decisions and a signed B7 push/PR authorization. All instruments must cover repository, branches, scope, prohibited operations and stop conditions.
5. OD-B10 keeps computer-use deferred; nothing in this instruction enables it. OD-B11 keeps the WhatsApp pathway closed.

---

## Verification checklist (by operator, at preparation)

1. Document exists at `docs/B7_EXECUTION_INSTRUCTION_DRAFT.md` — YES
2. All owner fields blank / not approved — YES (no checkbox pre-ticked; all identity/signature fields blank)
3. No operation approved by default — YES
4. No fabricated owner identity/signature — YES
5. Technical details derived from repository evidence — YES (`lib/agent/tools/*`, `package.json`, migration chain, blueprint §G)
6. No application code written — YES (draft only)
7. No dependencies or browser binaries installed — YES (`@playwright/test` 1.64.1 already present; `%LOCALAPPDATA%\ms-playwright` absent)
8. No migration created or executed — YES
9. No production operation — YES
10. Security gates not weakened — YES

**Status line:** `B7 EXECUTION INSTRUCTION DRAFT PREPARED — AWAITING OWNER SIGNATURE — B7 IMPLEMENTATION NOT STARTED`
