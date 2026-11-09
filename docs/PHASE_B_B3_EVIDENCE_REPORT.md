# Phase B · B3 — Permission & Safety Engine — Evidence Report

**Status:** implementation complete; verification green; PR not yet created at the time this report was committed.
**Authorization:** owner-signed `docs/OD02_PHASE_B_B3_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, SHA-256 `799C02A212569D4BDA17F8B5A6246DA961F262766A589BCC9DC451D91D75192C`, signed by the repository owner as `yuvraj singh`, authority `Repository owner SKLD`, date `09/11/2026 - 16:35 - Timezone: PKT` (validity 14 days).
**Base:** `main` @ `446d9667b20b2777903e54cad01e0daf2308a95f` (B2 merged via PR #233).
**Branch:** `codex/phase-b-b3-permission-safety-engine`.
**Implementation commit:** pending — this report is committed before PR creation, as required.
**Scope:** B3 only. B4–B9 are not started or authorized by this evidence.

---

## 1. Scope executed

The signed B3 scope was executed without expanding it:

| Deliverable | Delivered |
|---|---|
| Additive migration | `supabase/migrations/20261109020000_permission_safety_engine_b3.sql` (30th tracked migration) |
| Permission tables | `permission_grants`, `agent_approval_requests`, `agent_approval_decisions`, `credential_broker_metadata`, `security_alarms` — all workspace-scoped, RLS select-only, append-only triggers on audit/decision/alarm tables |
| `authorize()` PEP | `lib/agent/tools/permissionEngine.ts` — single `authorize(toolCall) → ALLOW/CHALLENGE/DENY` decision point; deny-by-default; content-free decision hash logged per verdict |
| Tier ladder | T0–T5 confirmation policy: T0 auto, T1 once-per-task, T2/T3/T4 per-action, T5 owner-only never agent-granted |
| Risk scoring | `lib/agent/tools/riskScoring.ts` — `data_sensitivity × side_effect × blast_radius` matrix; effective tier = max(declared, risk tier); never lowers |
| Grants API | `upsert_permission_grant`, `revoke_permission_grant` SECURITY DEFINER RPCs — owner/admin only |
| Approval engine | `record_approval_decision` SECURITY DEFINER RPC; generalized approval inbox (`agent_approval_requests`) separate from appointment review queues |
| Approval inbox | `listApprovalRequests`, `getApprovalRequest` — pending/approved/denied/expired status; never modifies `appointment_review_requests` or related tables |
| Credential broker contract | `lib/agent/tools/credentialBroker.ts` — typed contract, injected secret source, deterministic mock; content-free envelopes only; no plaintext to agent runtime |
| Workspace pause / kill switch | Reuses `workspaces.automation_paused` guard + `set_workspace_automation_paused` RPC; tenant kill switch flag; all fail-closed |
| Self-grant prohibition | DB: `nexa_permission_engine` role has SELECT only on permission/approval/alarm tables (no INSERT/UPDATE/DELETE); code: `authorize()` reads grants read-only; audit: guard trigger `guard_permission_table_write` raises on direct mutation outside owner RPCs |
| Feature flag | `AGENT_PERMISSION_ENGINE_ENABLED`, exact `"true"` only, hard-off when `NODE_ENV=production` or `VERCEL_ENV=production` |
| Docs | `docs/PHASE_B_B3_DESIGN_NOTE.md`; documented totals updated to **827** unit tests and **30** migrations |

Supporting modules: `lib/agent/tools/permissionTypes.ts`, `permissionGate.ts`, `permissionStore.ts`, `permissionSupabaseStore.ts`.

Design rationale, data model, RLS/grant matrix, fail-closed contract, and rollback are in `docs/PHASE_B_B3_DESIGN_NOTE.md`.

---

## 2. Boundaries honored

- No deploy, no production access, no hosted-database access, no production or staging migration application. The B3 migration is packaged only and is **not** applied to any hosted project.
- No live OAuth, model-provider, WhatsApp, calendar, browser, filesystem, computer-use, or external-network call. The credential broker uses a deterministic mock or an injected server-only secret source; envelopes are content-free references.
- WhatsApp outbound remains `false`; no outbound flag, sender, claim path, or agent→WhatsApp send path was added or changed.
- No existing appointment, WhatsApp, calendar, outbound, auth, or RLS gate was modified. The migration is additive and alters no existing table, policy, grant, trigger, or function. The appointment approval queues (`appointments`, `appointment_review_requests`, `appointment_review_decisions`, `appointment_booking_approvals`, `appointment_booking_attempts`, `pending_appointment_review_inbox`) are untouched.
- No new dependency: `package.json` changed only to register the five new B3 test files. `package-lock.json` is unchanged. No embeddings or pgvector.
- No direct push to `main`, no force-push, no history rewrite, no guard weakening. PR creation and merge remain owner-controlled.
- The operator did not sign, date, initial, or approve any instrument. The signed B3 instruction is the sole authorization; the operator did not edit the signed file.
- Root strays `page.tsx`, `route.ts`, `.codex-worktrees/`, the B1/B2 instruction copies, and the signed B3 instruction remain untouched and uncommitted.

---

## 3. Security contract

- RLS is enabled on all five new tables. Authenticated users receive `SELECT` only, scoped by `public.is_workspace_member(workspace_id)`; there is no authenticated insert/update/delete policy or table grant on any B3 table.
- `service_role` receives select-only table access; no direct insert/update/delete table grants. Every write goes through a reviewed `SECURITY DEFINER` RPC with `search_path = ''`.
- `upsert_permission_grant`, `revoke_permission_grant`, `record_approval_decision`, and `record_security_alarm` are revoked from `public`, `anon`, and `authenticated`, then granted only to `service_role`.
- Decision/alarm rows are append-only through `BEFORE UPDATE OR DELETE` triggers that raise.
- The grant RPCs require owner/admin workspace role via `public.workspace_has_role(workspace_id, array['owner','admin'])`; authentication is required.
- The approval decision RPC validates workspace match (request belongs to the caller's workspace), pending status, decision enum, and sha256 evidence hash.
- The `nexa_permission_engine` PostgreSQL role (`nologin noinherit nobypassrls`) receives SELECT only on all five tables — no INSERT/UPDATE/DELETE. Tested like `workspaceMigrations.test.ts` enforces the migration chain.
- `guard_permission_table_write` trigger raises on any INSERT/UPDATE/DELETE on `permission_grants` or `agent_approval_requests` outside the reviewed owner RPCs — detected as a `self_grant_attempt` security alarm.
- Risk scoring elevates tier but never lowers it: `effectiveTier = max(declaredTier, riskBaseTier)`. T5 is DENY at the PEP regardless of grants (owner-only, separately written authorization).
- T2+ can never proceed without a logged, unexpired approval. A missing, expired, malformed, or unknown grant yields DENY + alarm.
- Audit rows and alarms carry only ids, hashes, status, severity, and timestamps. Raw tool arguments, outputs, and plaintext secrets are never persisted.
- `lib/agent/tools/credentialBroker.ts` envelopes contain sha256 references only — never plaintext tokens/keys. `validateEnvelope` rejects non-hash references and raw secret patterns (`sk_`, `rk_live_`, `whsec_`, `gh*`, `github_pat_`, `xoxb*`, `AKIA*`, `sb_secret_`, raw JWTs).
- The kill switch is checked before any grant lookup or store access. The only enabling value is the exact string `"true"`; production builds and production Vercel environments are hard-off.
- All fail-closed: flag off → all DENY; workspace paused → all DENY; tenant kill switch off → all DENY; missing/expired grant → DENY + alarm.

---

## 4. Tests added

49 new tests in five files, all registered in the explicit `package.json` test list:

| File | Tests | Coverage |
|---|---:|---|
| `lib/agent/tools/permissionGate.test.ts` | 6 | exact-`true` flag, ambiguous values off, production hard-off, `isAgentPermissionEngineEnabled`, gate labels |
| `lib/agent/tools/riskScoring.test.ts` | 7 | out-of-range dimensions, risk matrix product→tier mapping, max score 125, clamping, effective tier never lowers, dimension preservation |
| `lib/agent/tools/permissionStore.test.ts` | 11 | upsert/idempotency on (workspace, tier, toolFamily), get/list/revoke, workspace scoping, validation (invalid tier/tool family/expired grant), tier validation |
| `lib/agent/tools/permissionEngine.test.ts` | 17 | DENY flag off/production/paused/kill switch/T5/no grant/expired grant; ALLOW T0 auto/T1/T2 with approval; CHALLENGE T1/T2 without approval; risk elevation grant check; decisionHash sha256 format |
| `lib/agent/tools/credentialBroker.test.ts` | 8 | mock broker content-free envelope, null for empty key, no plaintext secret, secret source broker, null for missing secret, envelope validation (valid/non-hash/plaintext rejection) |

`lib/workspaceMigrations.test.ts` now includes the B3 migration in `expectedMigrationChain`. Documented totals were updated to **827** unit tests and **30** tracked migrations in `NEXA_HANDOFF.md` and `docs/GO_LIVE.md`.

Two signed test obligations are explicitly evidenced:

- **Kill-switch drill:** `permissionGate.test.ts` proves flag-off and production hard-off prevent any engine access. `permissionEngine.test.ts` proves all-DENY when flag off, workspace paused, or tenant kill switch off.
- **Self-grant prohibition:** The static grant matrix (in `permissionStore.ts` validation + the migration's `nexa_permission_engine` role definition) gives the engine role SELECT only on permission/approval/alarm tables. The migration's `guard_permission_table_write` trigger raises on direct mutation outside owner RPCs.

---

## 5. Verification at the implementation head

Full repository gate: `npm run check` — **exit 0** at this head.

| Check | Result |
|---|---|
| Tracked-secret guard | passed, no secrets in tracked files |
| Production-build guard | passed |
| Documented count | 827 matches the runner (pass 827, fail 0) |
| Lint | 0 errors, 16 pre-existing warnings (none from B3 files) |
| Typecheck | clean |
| Unit tests | **827 pass, 0 fail** (778 before B3; +49) |
| Issue-report tests | 0 failures |
| Build | Next.js 16.4.5, compiled successfully |

B3 verification is local only (no Docker Linux engine on this Windows/OneDrive checkout; CI replay is the authoritative migration/RLS evidence path, consistent with B2).

---

## 6. Rollback

1. Set `AGENT_PERMISSION_ENGINE_ENABLED=false` or remove it; `authorize()` returns DENY for every call, the engine is dormant.
2. The five tables are additive and remain inert. No existing table, policy, grant, trigger, or function is altered.
3. If a full schema rollback is ever required, drop the B3 tables and functions in dependency order (`security_alarms`, `agent_approval_decisions`, `agent_approval_requests`, `credential_broker_metadata`, `permission_grants`); this is an owner-approved operation and was not performed in B3.

---

## 7. Open items

- The B3 migration is not applied to any hosted project; applying it is outside B3.
- B3 delivers the engine, grants API, approval inbox, credential broker contract, alarms, kill switch, and self-grant prohibition. Wiring `authorize()` into the B1/B2 executor call path, and any real secret source integration, is outside B3 and requires a later signed instruction.
- The local replay probe runs in CI rather than on this checkout because the local Docker/OneDrive environment is unavailable; consistent with B2.
- PR creation and merge remain owner-controlled. This report is committed before PR creation, as required.

---

**Status: `B3 IMPLEMENTATION COMPLETE — VERIFICATION GREEN — AWAITING OWNER PR CREATION/MERGE`**
