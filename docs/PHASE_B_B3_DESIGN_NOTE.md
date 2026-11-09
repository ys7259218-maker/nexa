# Phase B · B3 — Permission & Safety Engine — Design Note

**Status:** design for the signed B3 instruction (`docs/OD02_PHASE_B_B3_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, SHA-256 `799C02A212569D4BDA17F8B5A6246DA961F262766A589BCC9DC451D91D75192C`, signed 09/11/2026 16:35 PKT, binding tick `[x]`).
**Base:** `main` @ `446d9667b20b2777903e54cad01e0daf2308a95f` (B2 merged via PR #233).
**Branch:** `codex/phase-b-b3-permission-safety-engine`.
**Scope:** B3 only. B4–B9 are not authorized. No deploy, no production access, no live provider/OAuth/WhatsApp/calendar/browser/filesystem calls. Migration files only — no staging or production execution.

Blueprint references: `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B3) and §5.D (tier ladder T0–T5).

---

## 1. Baseline verified before design

Read-only inspection at the B3 base found:

- B1 provides the durable agent runtime: `agent_sessions`, `agent_tasks`, `agent_task_steps`, `agent_events`, atomic lease/claim RPCs, cooperative cancel, deadline watchdog, and the dedicated `nexa_agent_runtime` role. B1 steps are deterministic mocks only.
- B2 provides the tool registry, strict schema validator, executor, adapters, audit store, and the `agent_tool_manifests` / `agent_tool_invocations` tables with append-only trigger and fail-closed RPCs.
- Existing gate patterns are self-contained and fail closed: the only enabling value is the exact string `"true"`, and production is hard-off (`lib/agent/gate.ts`, `lib/agent/tools/gate.ts`, `lib/calendar/googleCalendarGate.ts`).
- Existing appointment approval queues exist and are owned by a separate staging slice: `appointments`, `appointment_review_requests`, `appointment_review_decisions`, `appointment_booking_approvals`, `appointment_booking_attempts`, `pending_appointment_review_inbox`. B3 must not touch any of these — the generalized approval engine is additive and separate.
- Calendar token store pattern: `calendar_oauth_connections` with encrypted tokens, column-level grants excluding encrypted columns, service-role-only writes (`lib/server/googleCalendarStore.ts`). B3's credential broker reuses this isolation pattern.
- Workspace kill-switch pattern: `workspaces.automation_paused` + guard trigger requiring `nexa.workspace_safety_write` config + `set_workspace_automation_paused` SECURITY DEFINER RPC (`lib/workspaceSafety.ts`, migration `20260824000800_workspace_kill_switch.sql`). B3 reuses these semantics.
- Tracked-secret guard: `lib/trackedSecretGuard.ts` scans tracked blobs for secrets; fail-closed. B3 audit/log paths will never contain raw content or plaintext secrets.
- Repository test discipline: explicit `node --test` file list in `package.json`, static migration/RLS contract tests, offline behaviour tests, documented test/migration counts enforced by `check:documented-count` and `operationalDocsTruth.test.ts`.
- Disposable local replay harness (`scripts/verifyLocalSupabase.ts`) runs rollback-only SQL probes through Docker after two canonical migration replays. CI executes it on a clean Linux checkout.

---

## 2. B3 deliverables

| Deliverable | Implementation (files only, no execution) |
|---|---|
| Additive migration(s) | Policy tables + grants API + approval tables/inbox + credential-broker metadata + alarm/audit rows; append-only dated migration(s); files only |
| Permission tables | `permission_grants` (workspace, tier, tool family, expiry, scope) |
| Approval tables/inbox | `agent_approval_requests` + `agent_approval_decisions` (generalized, separate from appointment queues) |
| Credential broker metadata | `credential_broker_metadata` (key references only — never plaintext secrets) |
| Audit alarms | `security_alarms` (self-grant attempts, expiry races, fail-closed denials) |
| `authorize()` PEP | Single decision point → ALLOW / CHALLENGE / DENY; tier ladder T0–T5; risk scoring elevates tier, never lowers |
| Self-grant prohibition | DB: agent role no INSERT/UPDATE on permission/approval tables; code: `authorize()` reads grants read-only; audit: mutations outside owner API → alarm |
| Credential broker contract | Typed contract with injected secret source + deterministic mock; never exposes plaintext to agent runtime |
| Workspace pause / kill switch | Per-workspace pause flag + tenant kill switch; fail-closed; reuses `automation_paused` semantics |
| Feature flag | `AGENT_PERMISSION_ENGINE_ENABLED`, absent/`false` = off; hard-off in production |
| Tests | Self-grant attempt ⇒ DB-denied + audit alarm; approval-expiry race; redaction corpus; T2+ impossible without logged approval; agent role cannot mutate permission/approval tables; secrets never in logs; fail-closed on missing grant; kill-switch drill; RLS cross-tenant contract; agent-role grant matrix; no new dependencies |

---

## 3. Data model

All tables are additive and workspace-scoped. No existing table, policy, grant, trigger, or function is altered. The appointment approval queues are not modified.

### `permission_grants`

`id`, `workspace_id` → `workspaces(id)`, `tier` (T0–T5), `tool_family` (text), `granted_by` → `auth.users(id)`, `scope_notes` (text), `expires_at` (timestamptz, nullable — null = no expiry), `created_at`, `updated_at`.

Constraints:
- `tier` check: `T0`/`T1`/`T2`/`T3`/`T4`/`T5`
- `tool_family` matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$`
- if `expires_at` is set, must be > `created_at`
- unique `(workspace_id, tier, tool_family)` — one active grant per combination

Grants are written only through reviewed owner/admin RPCs (`upsert_permission_grant`, `revoke_permission_grant`). Direct table writes are not granted to any API or worker role. The agent runtime role has SELECT only.

### `agent_approval_requests`

`id`, `workspace_id` → `workspaces(id)`, `tier`, `tool_family`, `requested_by` → `auth.users(id)`, `scope_notes`, `status` (`pending`/`approved`/`denied`/`expired`), `requested_at`, `expires_at`, `decided_at` (nullable), `decided_by` (nullable → `auth.users(id)`), `decision_evidence_hash` (nullable, sha256, content-free).

Constraints:
- `tier` check: T0–T5
- `status` check: pending/approved/denied/expired
- if `expires_at` is set, must be > `requested_at`
- `decided_at` is null unless status is approved/denied/expired

This is the generalized approval inbox. It is separate from `appointment_review_requests` / `appointment_booking_approvals` — B3 does not modify those tables.

### `agent_approval_decisions` (audit shadow of decisions)

`id`, `approval_request_id` → `agent_approval_requests(id)`, `decision` (approved/denied/expired), `decided_by` → `auth.users(id)`, `decided_at`, `evidence_hash` (sha256, content-free), `created_at`.

Append-only: trigger raises exception on UPDATE/DELETE.

### `credential_broker_metadata`

`id`, `workspace_id` → `workspaces(id)`, `credential_key` (text, e.g. provider identifier), `encrypted_reference` (text — opaque reference into server-only secret store, never plaintext), `last_rotated_at` (nullable), `created_at`, `updated_at`.

Constraints: `credential_key` pattern, unique `(workspace_id, credential_key)`.

The broker serializes into tool-call envelopes at the execution edge only. No plaintext secret crosses into the agent runtime; no plaintext secret is stored in this table.

### `security_alarms`

`id`, `workspace_id` → `workspaces(id)`, `alarm_kind` (`self_grant_attempt`/`approval_expiry_race`/`fail_closed_denial`/`missing_grant`/`unknown_grant`/`expired_grant`), `severity` (`low`/`medium`/`high`/`critical`), `detail_hash` (sha256, content-free), `occurred_at`, `resolved_at` (nullable), `resolved_by` (nullable → `auth.users(id)`).

Append-only: trigger raises exception on UPDATE/DELETE.

---

## 4. `authorize()` PEP — policy enforcement point

Single function: `authorize(toolCall) → ALLOW / CHALLENGE / DENY`.

Inputs: workspace_id, actor, tool family, tier (from tool manifest risk tier or elevated by risk score), invocation context.

Logic (deny-by-default):
1. **Feature flag check:** if `AGENT_PERMISSION_ENGINE_ENABLED` is not exactly `"true"`, or production hard-off → DENY (engine dormant).
2. **Workspace pause / kill switch:** if workspace `automation_paused` is true → DENY.
3. **Grant lookup:** find active, unexpired grant for `(workspace_id, tier, tool_family)`. If none → DENY + `missing_grant` alarm.
4. **Tier elevation:** risk score = `data_sensitivity × side_effect × blast_radius`; score elevates tier, never lowers. Re-check grant at elevated tier.
5. **Confirmation policy by tier:**
   - T0 (read within own workspace): ALLOW (auto, flag-gated).
   - T1 (write within own workspace, non-external): ALLOW if once-per-task covered by user-visible plan; else CHALLENGE.
   - T2 (external API read/write with tenant credentials): CHALLENGE — requires logged, unexpired approval; ALLOW only if an active unexpired approval exists.
   - T3 (external messaging/actions visible to third parties): CHALLENGE — per-action approval + full transcript evidence hash required.
   - T4 (browser drive sessions): CHALLENGE — session-start approval + per-sensitive-action approval (submit/upload/download).
   - T5 (settings, secrets, integrations config, WhatsApp send): DENY — owner-only, separately written authorization; never agent-granted.
6. **Decision caching:** per-step only, logged; no cross-step caching.
7. **Output:** ALLOW / CHALLENGE / DENY, always logged as an event (content-free hashes only).

T2+ can never proceed without a logged, unexpired approval. A missing, expired, malformed, or unknown grant yields DENY.

---

## 5. Self-grant prohibition — three layers

**Layer 1 (DB):** The agent runtime role (`nexa_agent_runtime`) has SELECT only on `permission_grants`, `agent_approval_requests`, `agent_approval_decisions`, `security_alarms`. No INSERT/UPDATE/DELETE. Tested like `workspaceMigrations.test.ts` enforces the 29-migration chain — a static test will assert the agent role's grants.

**Layer 2 (code):** `authorize()` is the single PEP and reads grants read-only. No code path writes permission/approval tables from the agent runtime.

**Layer 3 (audit):** Any INSERT/UPDATE/DELETE on permission/approval tables outside the reviewed owner/admin RPCs (`upsert_permission_grant`, `revoke_permission_grant`, `record_approval_decision`) is detected by a guard trigger and raises a `self_grant_attempt` security alarm. A self-grant attempt is DB-denied and produces an audit alarm.

---

## 6. Credential broker contract

Typed contract with an injected secret source and deterministic mock only:
- `broker.getCredential(workspaceId, credentialKey)` → returns an opaque serialized envelope (never plaintext).
- The envelope is consumed only at the tool execution edge; the agent runtime never receives plaintext secret values.
- Deterministic mock for tests; no live OAuth, network, model-provider, WhatsApp, or calendar calls.
- Secrets never appear in logs, audit rows, events, or agent context. Redaction enforced by `trackedSecretGuard`-style checks on any new logged fields.

---

## 7. Workspace pause / kill switch

- Per-workspace pause: reuses `workspaces.automation_paused` + `set_workspace_automation_paused` RPC (owner/admin only).
- Tenant kill switch: new flag gating the entire permission engine; when off, `authorize()` returns DENY for everything.
- Emergency controls: per-task cancel (existing B1), per-workspace pause, tenant kill switch, global disable flag — all fail-closed.
- Rollback = flag off + additive tables remain (no data loss, engine dormant).

---

## 8. Approval engine / inbox — does not modify appointment queues

The generalized approval engine uses `agent_approval_requests` / `agent_approval_decisions`. It is separate from and does not modify:
- `appointments`, `appointment_review_requests`, `appointment_review_decisions`, `appointment_booking_approvals`, `appointment_booking_attempts`, `pending_appointment_review_inbox`

Existing appointment review gates (`canQueueAppointmentReview`, `isSameOriginReviewRequest`, `reviewRouteGate`) are untouched.

---

## 9. Security contract & fail-closed

- Flags default `false`; hard-off in production.
- Kill switch leaves the permission engine dormant (all DENY).
- `authorize()` fails closed: missing / expired / malformed / unknown grant → DENY.
- Agent role: SELECT only on permission/approval/alarm tables; no INSERT/UPDATE/DELETE.
- Grants are owner/admin-only through reviewed SECURITY DEFINER RPCs.
- Self-grant attempts: DB-denied + audit alarm.
- Secrets: never in logs, audit rows, events, or agent context; plaintext never crosses into agent runtime.
- RLS: workspace-scoped (`is_workspace_member`); cross-tenant deny-by-default, tested with adversarial fixtures.
- No new dependencies (OD-B1). No embeddings / pgvector (OD-B2).
- WhatsApp outbound stays `false`; no agent→WhatsApp send path (OD-B11 closed).
- No direct push to `main`; no force-push; no history rewrite; no guard weakening.

---

## 10. Tests planned (no new dependencies)

| Test | Assertion |
|---|---|
| Self-grant attempt | agent role INSERT/UPDATE on permission/approval tables is DB-denied + `security_alarms` row |
| Approval-expiry race | expired approval cannot be used; `authorize()` returns DENY |
| Redaction corpus | no plaintext secrets in any logged field or audit row |
| T2+ without logged approval | `authorize()` returns DENY even if grant exists but no approval |
| Agent role cannot mutate permission tables | static grant-matrix test |
| Secrets never in logs | tracked-secret guard on new log paths |
| Fail-closed on missing grant | `authorize()` returns DENY with `missing_grant` alarm |
| Kill-switch drill | flag off ⇒ all DENY; engine dormant |
| RLS cross-tenant contract | workspace A cannot read workspace B's grants/approvals |
| Agent-role grant matrix | least-privilege allowlist verified |

---

## 11. Rollback

Feature flag off + additive tables remain. The engine becomes dormant (all DENY). No existing table, policy, grant, trigger, or function is altered, so rollback requires no schema reversal — only flag removal.
