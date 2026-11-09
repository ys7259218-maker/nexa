# Phase B · B4 — Planning & Orchestration — Design Note

**Status:** design for the signed B4 instruction (`docs/OD02_PHASE_B_B4_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, SHA-256 `7D4C4020944B5078452CD747D003AC9155EFC67E912093FA5092AD2E255C9A25`, signed 09/11/2026, binding tick `[x]`).
**Base:** `main` @ `e9917e94ac101ee5562cd5d640e67d391af13253` (B3 merged via PR #234).
**Branch:** `codex/phase-b-b4-planning-orchestration`.
**Scope:** B4 only. B5–B9 are not authorized. No deploy, no production access, no live provider/OAuth/WhatsApp/calendar/browser/filesystem calls. Migration files only — no staging or production execution.

Blueprint reference: `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B4).

---

## 1. Baseline verified before design

Read-only inspection at the B4 base found:

- B1 provides the durable agent runtime: `agent_sessions`, `agent_tasks`, `agent_task_steps`, `agent_events`, atomic lease/claim RPCs, cooperative cancel, deadline watchdog, `planVersion` on tasks, `planSteps` on the store, deterministic mock steps (`buildMockPlan`), and the dedicated `nexa_agent_runtime` role. B1 steps are deterministic mocks only.
- B2 provides the tool registry, strict schema validator, executor, adapters, audit store, and `agent_tool_manifests` / `agent_tool_invocations` tables with append-only trigger and fail-closed RPCs.
- B3 provides the permission & safety engine: `authorize()` PEC returning ALLOW/CHALLENGE/DENY, tier ladder T0–T5, risk scoring, `permission_grants`, `agent_approval_requests/decisions`, `credential_broker_metadata`, `security_alarms`, self-grant prohibition, workspace pause/kill switch, feature flag `AGENT_PERMISSION_ENGINE_ENABLED`.
- Existing gate patterns are self-contained and fail closed: the only enabling value is the exact string `"true"`, and production is hard-off (`lib/agent/gate.ts`, `lib/agent/tools/gate.ts`, `lib/agent/tools/permissionGate.ts`).
- Existing appointment approval queues exist and are owned by a separate staging slice — B4 must not touch `appointments`, `appointment_review_requests`, `appointment_review_decisions`, `appointment_booking_approvals`, `appointment_booking_attempts`, `pending_appointment_review_inbox`.
- No dedicated planner, context packer, DAG scheduler, or step recovery module exists anywhere in `lib/` or `app/`. B1's `buildMockPlan` is a 3-step deterministic mock, not a real planner.
- Repository test discipline: explicit `node --test` file list in `package.json`, static migration/RLS contract tests, offline behaviour tests, documented test/migration counts enforced by `check:documented-count` and `operationalDocsTruth.test.ts`.
- Disposable local replay harness (`scripts/verifyLocalSupabase.ts`) runs rollback-only SQL probes through Docker after two canonical migration replays.

---

## 2. B4 deliverables

| Deliverable | Implementation (files only, no execution) |
|---|---|
| Additive migration | Plan tables + planner RPCs + DAG/step tables; append-only dated migration(s); files only |
| Plan tables | `agent_plans` (plan per task, step cap, status), `agent_plan_steps` (seq, tool, tier, status, inputs hash, outputs hash) |
| Context packer | Packs bounded recent turns + workspace context into plan input, token-bounded |
| Step DAG scheduler | Schedules steps in seq order with dependency awareness, concurrent cap enforcement |
| Approval checkpoints | Pre-execution checkpoint per step via B3 `authorize()`; in-flight approval gating |
| Recovery | Per-task cancel, step retry with backoff, deadline watchdog, cooperative cancel |
| Feature flag | `AGENT_PLANNING_ORCHESTRATION_ENABLED`, absent/`false` = off; hard-off in production |
| Tests | Plan cap enforced; checkpoints cannot be bypassed silently; context bounded; recovery from interrupted step; deterministic plan under cap; RLS cross-tenant contract; agent role cannot mutate plan tables; fail-closed on missing checkpoint; kill-switch drill; no new dependencies |

---

## 3. Data model

All tables are additive and workspace-scoped. No existing table, policy, grant, trigger, or function is altered.

### `agent_plans`

`id`, `workspace_id` → `workspaces(id)`, `task_id` → `agent_tasks(id)`, `status` (`draft`/`approved`/`executing`/`completed`/`failed`/`cancelled`), `step_cap` (integer 1–25), `steps_completed` (integer 0–step_cap), `context_hash` (sha256, content-free), `created_at`, `updated_at`, `completed_at` (nullable).

Constraints: `step_cap between 1 and 25`, `steps_completed between 0 and step_cap`, `status` check: draft/approved/executing/completed/failed/cancelled.

Unique: `(workspace_id, task_id)` — one active plan per task.

Grants: SELECT only to `authenticated` (RLS workspace-scoped), SELECT to `service_role`. Mutations through `upsert_agent_plan`, `update_agent_plan_progress`, `cancel_agent_plan` SECURITY DEFINER RPCs (owner/admin only).

### `agent_plan_steps`

`id`, `plan_id` → `agent_plans(id)`, `seq` (integer ≥ 1), `tool_name`, `tool_version`, `tool_family`, `declared_tier` (T0–T5), `risk_score` (jsonb, content-free), `status` (`pending`/`running`/`succeeded`/`failed`/`skipped`/`cancelled`), `attempts` (integer 1–3), `max_attempts` (integer 1–3), `timeout_ms` (integer), `inputs_hash` (sha256, content-free), `outputs_hash` (sha256, nullable), `error_class` (nullable), `started_at` (nullable), `completed_at` (nullable), `created_at`, `updated_at`.

Constraints: `declared_tier in (T0..T5)`, `status` check, `attempts between 1 and max_attempts`, `max_attempts between 1 and 3`, unique `(plan_id, seq)`.

Append-only: trigger raises exception on UPDATE/DELETE of `agent_plan_steps` where status transitions from terminal to non-terminal.

### `agent_plan_checkpoints` (audit shadow)

`id`, `plan_step_id` → `agent_plan_steps(id)`, `checkpoint_type` (`pre_execution`/`post_execution`), `decision` (`ALLOW`/`CHALLENGE`/`DENY`), `decision_hash` (sha256, content-free), `checked_at`, `checked_by` (nullable → `auth.users(id)`).

Append-only: trigger raises exception on UPDATE/DELETE.

---

## 4. Planner module — `lib/agent/planner/`

Single Policy Enforcement Point integration: every plan step is authorized through B3 `authorize()` before execution.

### `planPacker`

Packs bounded context into plan inputs:
- `packContext(workspaceId, maxTokens)` → returns content-free context hash
- Bounded to configured token cap; never raw content in logs/audit

### `stepScheduler`

Schedules steps in `seq` order:
- Enforces workspace concurrent task cap (B1: 2 per workspace, 20 global)
- Respects step dependencies (seq ordering)
- Returns next executable step or null (all complete/blocked)

### `checkpointGate`

Pre-execution checkpoint for every step:
- Calls B3 `authorize()` with step's tier/tool family
- If CHALLENGE → step blocked, approval required via B3 `agent_approval_requests`
- If DENY → step marked failed, alarm recorded
- Checkpoint recorded in `agent_plan_checkpoints` (content-free decision hash)

### `stepExecutor`

Executes a single plan step:
- Increments `attempts`, respects `max_attempts` and `timeout_ms`
- On failure: retry up to `max_attempts` with backoff, else mark failed
- On success: record `outputs_hash` (content-free), increment `steps_completed`
- Deadline watchdog: fails closed on expired lease

### Feature flag

`AGENT_PLANNING_ORCHESTRATION_ENABLED`, exact `"true"`, hard-off in production. Gate checked before any planner operation.

---

## 5. Security contract & fail-closed

- Flags default `false`; hard-off in production.
- Kill switch leaves the planner dormant (all plans blocked).
- Checkpoints cannot be bypassed: every step requires `authorize()` ALLOW before execution.
- T5 tools require owner-only authorization; never agent-granted.
- Plan tables: SELECT only for `authenticated`/`service_role`; mutations through owner/admin RPCs only.
- Context packer: token-bounded, content-free hashes only — never raw content.
- Secrets: never in logs, audit rows, events, or agent context.
- RLS: workspace-scoped (`is_workspace_member`); cross-tenant deny-by-default.
- No new dependencies (OD-B1). No embeddings / pgvector (OD-B2).
- WhatsApp outbound stays `false`; no agent→WhatsApp send path (OD-B11 closed).
- No direct push to `main`; no force-push; no history rewrite; no guard weakening.

---

## 6. Rollback

Feature flag off + additive tables remain. The planner becomes dormant (all plans blocked). No existing table, policy, grant, trigger, or function is altered, so rollback requires no schema reversal — only flag removal.
