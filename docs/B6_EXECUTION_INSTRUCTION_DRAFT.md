# B6 EXECUTION INSTRUCTION — DRAFT FOR OWNER AUTHORIZATION (MODEL & INFERENCE ABSTRACTION)

> ## DRAFT — NOT SIGNED — NOT AUTHORIZATION
> This document is a **preparation artifact only**. It grants nothing until the accountable owner signs Section K after reviewing every section. Until signed by the owner and countersigned by the technical execution operator, it is a proposal with blank decision fields. A chat message, verbal statement, or agent-prepared text does **not** count as this instruction.

**Draft prepared:** 2026-11-11 (operator — technical execution only, NOT an owner and NOT an approver)
**Repository:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` (remote: `https://github.com/ys7259218-maker/nexa.git`)
**Current branch:** `codex/phase-b-b5-memory-system` @ `a69d35e` (PENDING OWNER CONFIRMATION — verify against live `git status` before execution)
**Origin/main:** `89d6747` (B5 merged per owner confirmation) (PENDING OWNER CONFIRMATION)
**Governing status:** Phase B1–B5 complete and merged to `main`. Phase B6 NOT STARTED. Stage F authorization hold preserved per `OD-01_AUTHORIZATION_EVIDENCE_INTAKE.md`.

---

## A. Instruction identity (owner completes — all blank)

| Field | Owner entry |
|---|---|
| Full legal name (as on OD-01 signature) | _________yuvraj singh _____________________ |
| Role / authority | _________SKLD_____________________ |
| Instruction issue date & time | _________11/11/2026 - 10:30_____________________ |
| Timezone | ____________PKT__________________ |
| Internal reference / ticket (optional) | ______________________________ |

---

## B. Approved repository & branches (facts prefilled from reports; owner must confirm or correct)

| Item | Value | Owner confirm/correct |
|---|---|---|
| Repository (local) | `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` | `[ ]` Correct `[ ]` Correct to: ______________ |
| Repository (remote) | `https://github.com/ys7259218-maker/nexa.git` | `[ ]` Correct `[ ]` Correct to: ______________ |
| Current work branch | `codex/phase-b-b5-memory-system` @ `a69d35e` | `[ ]` Correct `[ ]` Correct to: ______________ |
| Source branch (candidate — owner MUST name) | ______________________________ | `[ ]` Named knowingly `[ ]` UNVERIFIED |
| Destination branch (candidate — owner MUST name; never `main` unless explicitly written) | ______________________________ | `[ ]` Named knowingly `[ ]` UNVERIFIED |

---

## C. Approved implementation scope — B6 Model & Inference Abstraction

Per `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §F (B6), the following scope is **proposed** for owner approval. Each item is **PENDING OWNER APPROVAL** until explicitly checked.

### C1. ChatModel contract (additive, does not modify existing `AIProvider`)

| Item | Description | Owner decision |
|---|---|---|
| C1a | Define `ChatModel` interface: message list in → text/structured/tool-calls/usage out | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C1b | Keep existing `AIProvider` interface untouched (draft pipeline unchanged) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C1c | New contract is additive only — no existing route, test, or provider modified | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C2. Provider adapters

| Item | Description | Owner decision |
|---|---|---|
| C2a | `mock` adapter — remains default, deterministic, offline, unkeyed | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C2b | `openai` adapter — remains offline, unkeyed, owner-activated only | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C2c | `openai-compatible` adapter — remains offline, unkeyed, owner-activated only | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C2d | Open-weight HTTP adapter — **PROPOSED only**, not implemented in B6 | `[ ]` Approve for future consideration `[ ]` Reject `[ ]` Defer — initials ________ |

### C3. Routing policy & fallback ladder

| Item | Description | Owner decision |
|---|---|---|
| C3a | Routing policy table per task class (planning / chat / extraction / embedding) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C3b | Deterministic fallback ladder (primary → cheaper secondary → mock-with-degraded-limitations) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C3c | Fallback to `mock` is safe-terminal — never silently "acts smart" | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C4. Usage metering & budget circuit breaker

| Item | Description | Owner decision |
|---|---|---|
| C4a | `agent_usage_ledger` table: `workspace_id`, `task_id`, `model`, `tokens_in`, `tokens_out`, `cost_estimate`, `duration_ms`, `created_at` — tenant-scoped, append-only | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C4b | Per-task budget ceiling (tokens, cost, wall-clock) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C4c | Per-workspace daily cost ceiling (owner-adjustable policy row) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C4d | Circuit breaker: breach → task-level `NEEDS_USER_INPUT`, never runaway spend | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C4e | Breaker events audited; agent role cannot edit ceiling rows | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

### C5. Evaluation promotion gate

| Item | Description | Owner decision |
|---|---|---|
| C5a | Offline safety evals remain minimum gate for any provider activation | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| C5b | Each provider activation requires owner-approved eval pack result before policy-table entry flips | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |

---

## D. Explicitly excluded operations (remain prohibited unless SEPARATE WRITTEN AUTHORIZATION exists)

| Operation | Status |
|---|---|
| Provider activation (any real model key loaded into repo or runtime) | PROHIBITED — requires separate OD-B6 owner authorization + provider terms/DPA review + key-handling arrangements outside repo |
| External billing integration | PROHIBITED — Phase B ships internal metering only (OD-B9 boundary) |
| Foundation model training / development | PROHIBITED — DEXYBOR explicitly designed as not owning a foundation model (blueprint §5, stage 6) |
| Production deployment | PROHIBITED — release NO-GO until G7 with owner signatures |
| Production database migrations | PROHIBITED — migration files only, local/CI disposable replay |
| Live OAuth, OpenAI network calls, model-provider calls | PROHIBITED — no live external calls in B6 implementation |
| WhatsApp outbound activation | PROHIBITED — `WHATSAPP_OUTBOUND_ENABLED` stays `false` (OD-B11 closed) |
| Deploy to production | PROHIBITED |
| `npm audit fix` / `--force` | PROHIBITED |
| Unreviewed major dependency upgrades | PROHIBITED |

---

## E. Permitted file modifications (additive only)

| Path | Description | Owner decision |
|---|---|---|
| `lib/ai/chatModel.ts` (NEW) | `ChatModel` interface + types | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/ai/chatModel.test.ts` (NEW) | Unit tests for contract | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/ai/routingPolicy.ts` (NEW) | Routing table + fallback ladder logic | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/ai/routingPolicy.test.ts` (NEW) | Unit tests for routing | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/ai/usageLedger.ts` (NEW) | `agent_usage_ledger` record type + append-only helpers | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/ai/usageLedger.test.ts` (NEW) | Unit tests for ledger | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/ai/circuitBreaker.ts` (NEW) | Budget ceiling + breaker logic | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `lib/ai/circuitBreaker.test.ts` (NEW) | Unit tests for breaker | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| `supabase/migrations/202611XXXX_agent_usage_ledger_b6.sql` (NEW) | Migration for `agent_usage_ledger` table (append-only) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ |
| Existing `lib/ai/provider.ts`, `mockProvider.ts`, `openAIProvider.ts`, `openAICompatibleProvider.ts`, `aiProviderStatus.ts`, `server/aiProvider.ts` | **NOT MODIFIED** — kept untouched | n/a (explicitly excluded) |
| `package.json` / `package-lock.json` | **NOT MODIFIED** — zero new dependencies per OD-B1 recommendation | n/a (explicitly excluded unless OD-B1 approves) |

---

## F. Migration restrictions

| Restriction | Detail |
|---|---|
| Append-only | New migration files only; existing migration files byte-frozen |
| No production execution | Migration files exist locally/CI disposable replay only; never applied to hosted/production DB |
| No schema alteration to existing tables | B6 migration creates new `agent_usage_ledger` table only; no `ALTER` on existing tables |
| RLS by `workspace_id` | All new tables inherit workspace-scoped RLS from day 1 |
| Least-privilege roles | Agent DB role grants only on new agent tables, per allow-list test discipline |

---

## G. Dependency modification restrictions

| Restriction | Detail |
|---|---|
| Zero new dependencies | Per OD-B1 recommendation (Option C): zero-new-deps typed contracts + internal validator util only |
| No `npm audit fix` / `--force` | Non-waivable (per `OD-01_OWNER_AUTHORIZATION_DRAFT.md` §G) |
| No unreviewed major upgrades | Non-waivable |
| No guessed version floors | Every target re-verified freshly at execution time |
| Before/after `npm audit --json` evidence | Mandatory for any dependency change (none approved in this draft) |
| Lockfile changes | Only to serve approved dependency rows (none approved in this draft) |

---

## H. Production restrictions

| Restriction | Detail |
|---|---|
| No production deployment | Vercel or any host — PROHIBITED |
| No production DB access | No hosted database connections, migrations, or writes |
| No production credentials | No changes to production env vars, secrets, or connected infrastructure |
| No customer-facing workflow enablement | B6 has no user-facing surface |
| `PRODUCTION_RELEASE_APPROVED` guard | No Phase B flag may weaken this guard |
| Flags default off | Every B6 mutating capability behind explicit flag defaulting to disabled |

---

## I. Testing and verification requirements

| Check | Command | Required |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | `[ ]` Required |
| Lint | `npm run lint` | `[ ] | Required (0 errors) |
| Unit tests | `npm test` | `[ ]` Required (all pass) |
| Issue reports | `npm run test:issue-reports` | `[ ]` Required |
| Documented count | `npm run check:documented-count` | `[ ]` Required (documented total matches runner total) |
| Tracked secrets | `npm run check:tracked-secrets` | `[ ]` Required |
| Production build guard | `npm run check:production-build` | `[ ]` Required |
| Full check | `npm run check` | `[ ]` Required (all sub-checks pass) |
| Migration lint | `npm run verify:supabase:local` | `[ ]` Required (local disposable DB only) |

---

## J. Rollback requirements

| Item | Rollback approach |
|---|---|
| Feature flag | All B6 capabilities behind flag defaulting to off; flag off = engine dormant |
| Policy table | Revert to mock-only instantly (reversible) |
| Adapters | Dormant code — no runtime impact if unused |
| Migration | Additive table only; no existing schema altered; rollback = do not apply |
| Code | New files only — deletion of new files restores prior state |

---

## K. Stop conditions

| Condition | Action |
|---|---|
| Verification failure (`npm run check` red) | STOP + report + wait for owner |
| Any HEAD / `origin/main` change since signing | Fresh approval required |
| Failed gate | Fresh approval required |
| Scope conflict with OD-01 or OD-B decisions | STOP — do not proceed |
| Any need for new dependency, real secret, real-database access, or external call | STOP — separate authorization required |
| Expiry date passing | Fresh approval required |
| Owner revocation (in writing, anytime) | Effective immediately |

---

## L. Owner authorization & signatures (blank — humans only)

**Repository owner / authorized decision-maker**

- Full legal name: __________yuvraj singh ____________________
- Role / authority: ____________SKLD__________________
- Signature (type full name again): _______________yuvraj singh _______________
- Date & time typed: _________11/11/2026 - 10:30_____________________ Timezone: _________PKT_____________________

**Technical execution acknowledgment (human accountable operator)**

- Name / role: _____________SKLD_________________
- Signature: _____________yuvraj singh_________________
- Date & time typed: __________11/11/2026 - 10:30____________________ Timezone: ______________PKT________________

---

## M. Mandatory statements

1. **This file, unsigned or incomplete, grants no permission.** The operator executes nothing on chat statements, verbal approval, intent expressions, or any agent-prepared text.
2. **B6 implementation has NOT started.** No application code, dependencies, migrations, or production operations have been performed as part of this draft.
3. **All fields marked `[ ]` UNVERIFIED or PENDING OWNER APPROVAL must be completed by the owner personally.** The operator must not fill owner fields.
4. This instruction works **only together with** the signed OD-01 authorization (`OD-01_OWNER_AUTHORIZATION_SIGNED.*`) and the OD-B P0 decisions (`OD_B_P0_SIGNED.*`). All three instruments must cover: repository, source/destination branches, approved scope, prohibited operations, stop conditions.

---

## Verification checklist (by operator, at preparation)

1. Document exists at `docs/B6_EXECUTION_INSTRUCTION_DRAFT.md` — YES
2. All owner fields blank / not approved — YES (no checkbox pre-ticked; all identity/signature fields blank)
3. No operation approved by default — YES
4. No fabricated owner identity/signature — YES (all identity/signature fields blank)
5. Technical details derived from repository evidence — YES (blueprint §F, existing `lib/ai/*` modules, `package.json`, migration patterns)
6. No application code written — YES (this is a draft instruction document only)
7. No dependencies changed — YES (package.json untouched)
8. No migrations executed — YES (migration file proposed only, not created)
9. No production operation — YES (all production restrictions listed in Section H)
10. Security gates not weakened — YES (all exclusions in Section D preserved)

**Status line:** `B6 EXECUTION INSTRUCTION DRAFT PREPARED — AWAITING OWNER SIGNATURE — B6 IMPLEMENTATION NOT STARTED`