# Phase B · B5 — Memory System — Design Note

**Status:** design for the signed B5 instruction (`docs/OD02_PHASE_B_B5_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, SHA-256 `4ACDBB57284FD92213AAA1EA978E9C2003DC419F821C0221BDBC66A6E8DF25BF`, signed 09/11/2026, binding tick `[x]`).
**Base:** `main` @ `8662a4898ba4c4ebf1e4fe70b8a5cebba16e9a59` (B4 merged via PR #235).
**Branch:** `codex/phase-b-b5-memory-system`.
**Scope:** B5 only. B6–B9 are not authorized. No deploy, no production access, no live provider/OAuth/WhatsApp/calendar/browser/filesystem calls. Migration files only — no staging or production execution.

Blueprint references: `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B5) and §E (memory architecture).

---

## 1. Baseline verified before design

Read-only inspection at the B5 base found:

- B1 provides the durable agent runtime: `agent_sessions`, `agent_tasks`, `agent_task_steps`, `agent_events`, atomic lease/claim RPCs, cooperative cancel, deadline watchdog, `planVersion` on tasks, `planSteps` on the store, and the dedicated `nexa_agent_runtime` role. B1 steps are deterministic mocks only.
- B2 provides the tool registry, strict schema validator, executor, adapters, audit store, and `agent_tool_manifests` / `agent_tool_invocations` tables with append-only trigger and fail-closed RPCs.
- B3 provides the permission & safety engine: `authorize()` PEC returning ALLOW/CHALLENGE/DENY, tier ladder T0–T5, risk scoring, `permission_grants`, `agent_approval_requests/decisions`, `credential_broker_metadata`, `security_alarms`, self-grant prohibition, workspace pause/kill switch, feature flag `AGENT_PERMISSION_ENGINE_ENABLED`.
- B4 provides the planning & orchestration module: planner, context packer, step DAG scheduler, approval checkpoints, recovery, `agent_plans`, `agent_plan_steps`, `agent_plan_checkpoints` tables, feature flag `AGENT_PLANNING_ORCHESTRATION_ENABLED`.
- Existing `knowledge_entries` table exists from earlier migrations (Knowledge v0). M4 knowledge retrieval uses this table; embeddings remain deferred (OD-B2).
- Existing gate patterns are self-contained and fail closed: the only enabling value is the exact string `"true"`, and production is hard-off.
- Existing appointment approval queues exist and are owned by a separate staging slice — B5 must not touch `appointments`, `appointment_review_requests`, `appointment_review_decisions`, `appointment_booking_approvals`, `appointment_booking_attempts`, `pending_appointment_review_inbox`.
- M0 conversation context (bounded recent turns) exists and is untouched by B5.
- Repository test discipline: explicit `node --test` file list in `package.json`, static migration/RLS contract tests, offline behaviour tests, documented test/migration counts enforced by `check:documented-count` and `operationalDocsTruth.test.ts`.
- Disposable local replay harness (`scripts/verifyLocalSupabase.ts`) runs rollback-only SQL probes through Docker after two canonical migration replays.

---

## 2. B5 deliverables

| Deliverable | Implementation (files only, no execution) |
|---|---|
| Additive migration | Memory layer tables + consent records + retention/deletion cascade; append-only dated migration(s); files only |
| M1 session scratchpad table | `memory_session_scratchpad` — task-scoped working state, task TTL, workspace-scoped RLS |
| M2 task memory table | `memory_task_memory` — structured step outputs, artifacts, evidence links, task retention window, workspace-scoped RLS |
| M3 user-approved persistent memory table | `memory_user_approved_facts` — explicit facts the user chose to keep, until user edits/deletes, consent + audit + user-visible list/edit/delete |
| M5 external data references table | `memory_external_data_refs` — URLs/IDs only, never bulk-fetched copies without retention policy |
| Consent records table | `memory_consent_records` — explicit consent for M3 persistence, auditable |
| Consent flow contract | M3 requires explicit consent; consent missing ⇒ not stored; consent records auditable |
| Retention/deletion cascade | Deletion APIs cascade M1–M3/M4 for a tenant; retention windows owner-decided |
| Feature flag | `AGENT_MEMORY_SYSTEM_ENABLED`, absent/`false` = off; hard-off in production |
| Tests | Retention honored; deletion cascades; consent records auditable; no unbounded context growth; cross-tenant probes; PII-scan fixtures; consent missing ⇒ not stored; injection via memory reads (fixtures); RLS cross-tenant contract; agent role cannot mutate memory tables; fail-closed on missing consent; kill-switch drill; **no new dependencies** |

---

## 3. Data model

All tables are additive and workspace-scoped. No existing table, policy, grant, trigger, or function is altered. The `knowledge_entries` table (M4) already exists from Knowledge v0 migration; B5 does not alter it. M0 conversation context is untouched.

### `memory_session_scratchpad` (M1)

`id`, `workspace_id` → `workspaces(id)`, `task_id` → `agent_tasks(id)`, `scratchpad_key` (text), `scratchpad_value` (jsonb, content-free hashes only), `ttl_seconds` (integer), `expires_at` (timestamptz), `created_at`, `updated_at`.

Constraints: `ttl_seconds between 1 and 604800` (1 second to 7 days), `expires_at > created_at`.

Unique: `(workspace_id, task_id, scratchpad_key)`.

Grants: SELECT only to `authenticated` (RLS workspace-scoped), SELECT to `service_role`. Mutations through `upsert_memory_scratchpad`, `delete_memory_scratchpad` SECURITY DEFINER RPCs (owner/admin only).

### `memory_task_memory` (M2)

`id`, `workspace_id` → `workspaces(id)`, `task_id` → `agent_tasks(id)`, `step_seq` (integer), `output_key` (text), `output_value_hash` (sha256, content-free), `artifact_ref` (text, nullable), `evidence_link` (text, nullable), `retention_window_seconds` (integer), `expires_at` (timestamptz), `created_at`, `updated_at`.

Constraints: `retention_window_seconds between 1 and 604800`, `expires_at > created_at`, `output_value_hash ~ '^[0-9a-f]{64}$'`.

Unique: `(workspace_id, task_id, step_seq, output_key)`.

Grants: SELECT only to `authenticated` (RLS workspace-scoped), SELECT to `service_role`. Mutations through `upsert_memory_task_memory`, `delete_memory_task_memory` SECURITY DEFINER RPCs (owner/admin only).

### `memory_user_approved_facts` (M3)

`id`, `workspace_id` → `workspaces(id)`, `fact_key` (text), `fact_value_hash` (sha256, content-free), `consent_record_id` → `memory_consent_records(id)`, `expires_at` (timestamptz, nullable — null = until user deletes), `created_at`, `updated_at`, `deleted_at` (timestamptz, nullable).

Constraints: `fact_value_hash ~ '^[0-9a-f]{64}$'`.

Unique: `(workspace_id, fact_key)`.

Grants: SELECT only to `authenticated` (RLS workspace-scoped), SELECT to `service_role`. Mutations through `upsert_memory_user_approved_fact`, `delete_memory_user_approved_fact` SECURITY DEFINER RPCs (owner/admin only). M3 requires explicit consent — consent missing ⇒ not stored.

### `memory_consent_records`

`id`, `workspace_id` → `workspaces(id)`, `user_id` → `auth.users(id)`, `consent_type` (text, e.g. 'm3_persistent_memory'), `granted` (boolean), `granted_at` (timestamptz), `revoked_at` (timestamptz, nullable), `evidence_hash` (sha256, content-free), `created_at`.

Constraints: `consent_type ~ '^[a-z][a-z0-9_]*$'`.

Unique: `(workspace_id, user_id, consent_type)` — one active consent per user per type.

Grants: SELECT only to `authenticated` (RLS workspace-scoped), SELECT to `service_role`. Mutations through `record_memory_consent` SECURITY DEFINER RPC (owner/admin only).

### `memory_external_data_refs` (M5)

`id`, `workspace_id` → `workspaces(id)`, `ref_key` (text), `ref_url` (text, nullable), `ref_id` (text, nullable), `revalidation_window_seconds` (integer), `expires_at` (timestamptz), `created_at`, `updated_at`.

Constraints: `revalidation_window_seconds between 1 and 604800`, `expires_at > created_at`, `(ref_url IS NOT NULL) OR (ref_id IS NOT NULL)` — at least one reference.

Unique: `(workspace_id, ref_key)`.

Grants: SELECT only to `authenticated` (RLS workspace-scoped), SELECT to `service_role`. Mutations through `upsert_memory_external_data_ref`, `delete_memory_external_data_ref` SECURITY DEFINER RPCs (owner/admin only). M5 references-only default — URLs/IDs only, never bulk-fetched copies without retention policy.

---

## 4. Memory services — `lib/agent/memory/`

### `memoryConsentService`

- `recordConsent(workspaceId, userId, consentType, granted, evidenceHash)` → records consent via `record_memory_consent` RPC
- `hasConsent(workspaceId, userId, consentType)` → checks for active, unrevoked consent
- `revokeConsent(workspaceId, userId, consentType)` → revokes consent via RPC
- M3 requires explicit consent — consent missing ⇒ not stored

### `memorySessionService` (M1)

- `upsertScratchpad(workspaceId, taskId, scratchpadKey, scratchpadValueHash, ttlSeconds)` → via `upsert_memory_scratchpad` RPC
- `getScratchpad(workspaceId, taskId, scratchpadKey)` → RLS-scoped read
- `deleteScratchpad(workspaceId, taskId, scratchpadKey)` → via `delete_memory_scratchpad` RPC
- `expireScratchpads(workspaceId)` → expires scratchpads past `expires_at`

### `memoryTaskService` (M2)

- `upsertTaskMemory(workspaceId, taskId, stepSeq, outputKey, outputValueHash, artifactRef, evidenceLink, retentionWindowSeconds)` → via `upsert_memory_task_memory` RPC
- `getTaskMemory(workspaceId, taskId)` → RLS-scoped read
- `deleteTaskMemory(workspaceId, taskId)` → via `delete_memory_task_memory` RPC

### `memoryUserApprovedFactsService` (M3)

- `upsertUserApprovedFact(workspaceId, factKey, factValueHash, consentRecordId, expiresAt)` → via `upsert_memory_user_approved_fact` RPC — requires consent
- `getUserApprovedFacts(workspaceId)` → RLS-scoped read, excludes deleted
- `deleteUserApprovedFact(workspaceId, factKey)` → via `delete_memory_user_approved_fact` RPC — soft delete (sets deleted_at)
- M3 consent missing ⇒ not stored

### `memoryExternalDataRefsService` (M5)

- `upsertExternalDataRef(workspaceId, refKey, refUrl, refId, revalidationWindowSeconds)` → via `upsert_memory_external_data_ref` RPC
- `getExternalDataRefs(workspaceId)` → RLS-scoped read
- `deleteExternalDataRef(workspaceId, refKey)` → via `delete_memory_external_data_ref` RPC
- M5 references-only default — URLs/IDs only

### Feature flag

`AGENT_MEMORY_SYSTEM_ENABLED`, exact `"true"`, hard-off in production. Gate checked before any memory operation.

---

## 5. Security contract & fail-closed

- Flags default `false`; hard-off in production.
- Kill switch leaves memory system dormant (all reads return empty, all writes denied).
- M3 requires explicit consent — consent missing ⇒ not stored; consent records auditable.
- Memory tables: SELECT only for `authenticated`/`service_role`; mutations through owner/admin RPCs only.
- Context packer (B4) integrates with M1/M2/M3 — content-free hashes only.
- Secrets: never in logs, audit rows, events, or agent context. PII-minimization scan before M3 persistence.
- RLS: workspace-scoped (`is_workspace_member`); cross-tenant deny-by-default, tested with adversarial fixtures.
- No new dependencies (OD-B1). No embeddings / pgvector (OD-B2).
- WhatsApp outbound stays `false`; no agent→WhatsApp send path (OD-B11 closed).
- No direct push to `main`; no force-push; no history rewrite; no guard weakening.
- M0 conversation context (bounded recent turns) is untouched by B5.
- M5 references-only — URLs/IDs only, never bulk-fetched copies without retention policy.

---

## 6. Rollback

Feature flag off + additive tables remain. Memory system becomes dormant. M3 off ⇒ context collapses to M0 (existing). No existing table, policy, grant, trigger, or function is altered, so rollback requires no schema reversal — only flag removal.
