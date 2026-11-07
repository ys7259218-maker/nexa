# Phase B · B1 — Agent Runtime Foundation — Design Note

**Status:** implementation design for the signed B1 instruction (`docs/OD02_PHASE_B_B1_EXECUTION_INSTRUCTION_SIGNED.md`, SHA-256 `E49CDEC6…`, signed 08/11/2026 00:39 PKT).
**Base:** `main` @ `6093a31eeb18c00bc3607764dbe67743ee90288d` (Stage F merged via PR #230).
**Branch:** `codex/phase-b-b1-agent-runtime`.
**Scope:** B1 only. B2–B9 are not authorized. No deploy, no production access, no live provider/OAuth/WhatsApp calls.

---

## 1. Baseline verified before design

Read-only inspection at the B1 base found:

- A mature multi-tenant Supabase schema: workspace tenancy, `is_workspace_member(uuid)` and `workspace_has_role(uuid, text[])`, RLS on every business table, append-only audit events, and a least-privilege grant hardening migration.
- An atomic claim pattern already proven for outbound sends (`claim_outbound_message_send`, `finalize_outbound_message_send`, `release_outbound_message_send`) with service-role-only execution and typed fail-closed adapters (`lib/server/outboundClaim.ts`).
- Feature flags are read from environment variables and are fail-closed; `inspectClosedBetaEnvironment` requires explicit `false` in the closed beta. There is **no** agent-runtime flag, table, RPC, worker, queue, or SSE endpoint yet.
- Existing test discipline: explicit file list in `package.json`, `node --test`, static migration/RLS contract tests, offline FSM/contract tests, and documented test/migration counts enforced by `check:documented-count` and `operationalDocsTruth.test.ts`.
- Next.js 16 route handlers and pages use Promise-based `params`, server components, `requireAuthenticatedUser()`, `createSupabaseServerClient()`, and Web Streams for streaming responses.

## 2. B1 deliverables

| Deliverable | Implementation |
|---|---|
| Additive migration | `supabase/migrations/20261108010000_agent_runtime_b1.sql` |
| Sessions / tasks / steps / events | Four new `public.agent_*` tables, RLS select-only for workspace members |
| Task FSM | Pure TypeScript FSM mirrored by a SQL transition allow-list |
| Lease / claim | Atomic `claim_agent_task` RPC with lease token, heartbeat, release, stale-lease requeue |
| Cooperative cancel | `request_agent_task_cancel` RPC; flag checked between every step; immediate cancel when no active lease |
| Timeout / watchdog | Per-step wall clock in the runtime; `reap_agent_tasks` fails past-deadline tasks with evidence and cancels abandoned cancel requests |
| Mock-executed steps | Deterministic `mock.echo` steps only; no provider, network, filesystem, browser, or messaging call |
| SSE skeleton | `GET /api/agent/tasks/[id]/events` streams durable `agent_events` rows |
| Read-only console | `app/settings/agent-runtime/page.tsx` lists task state; no mutation controls |
| Feature flag | `AGENT_RUNTIME_ENABLED`, absent/`false` = off; hard-off in production and on Vercel production builds |

## 3. Data model

All tables are additive and workspace-scoped. Composite foreign keys enforce that a task, step, or event can never cross a workspace boundary.

### `agent_sessions`
`id`, `workspace_id` → `workspaces(id)`, `user_id` → `auth.users(id)`, `channel` (`console` only in B1), `model_policy` (`mock` only in B1), `status` (`active`/`closed`), `created_at`, `last_active_at`.
Unique `(workspace_id, id)` so child tables can use a composite tenant-safe FK.

### `agent_tasks`
`id`, `session_id`, `workspace_id`, `goal` (1–2000 chars), `state`, `plan_version`, `cancel_requested`, `cancel_requested_at`, `deadline_at`, `max_steps` (1–25), `created_by`, `created_at`, `updated_at`, `last_heartbeat_at`, `lease_token`, `lease_expires_at`, `completed_at`, `failure_reason`, `evidence jsonb`.
Constraints: lease pair (`token`/`expires_at` both null or both set), cancel pair, terminal-state/completed-at pair, `deadline_at > created_at`, composite FK `(workspace_id, session_id)` → sessions, unique `(workspace_id, id)`.

### `agent_task_steps`
`id`, `task_id`, `workspace_id`, `seq`, `kind` (`mock`), `label`, `tool_name` (`mock.echo`), `tool_version`, `args_hash` (64 hex), `status`, `attempts`, `idempotency_key`, `evidence jsonb`, `started_at`, `completed_at`, `created_at`, `updated_at`.
Unique `(task_id, seq)` and `(task_id, idempotency_key)`; composite FK `(workspace_id, task_id)` → tasks. The idempotency key is `${task_id}:${seq}`; the runtime never executes a `SUCCEEDED` step again.

### `agent_events`
`id`, `workspace_id`, `task_id`, `seq` (per-task, monotonic), `type`, `payload jsonb`, `created_at`.
Unique `(task_id, seq)`; composite FK to tasks. `seq` is assigned under a task row lock by `append_agent_event`, so concurrent writers cannot duplicate a sequence. A `BEFORE UPDATE` trigger rejects mutation; rows are append-only. Payloads carry ids, states, reason codes and counts only — never goals, message bodies, credentials, or free-form model output.

## 4. Task FSM

States: `INTAKE`, `CLARIFY`, `PLANNING`, `AWAITING_APPROVAL`, `EXECUTING`, `VERIFYING`, `NEEDS_USER_INPUT`, `COMPLETE`, `FAILED`, `CANCELLED`.
Terminal: `COMPLETE`, `FAILED`, `CANCELLED` (no outgoing transitions).

The authoritative allowed pairs live in both `lib/agent/fsm.ts` and the SQL `agent_task_transition_allowed(from, to)` function; a contract test checks that every TypeScript pair appears in the migration.

B1’s mock path uses only `INTAKE → PLANNING → EXECUTING → VERIFYING → COMPLETE`, plus `CANCELLED`/`FAILED`. `CLARIFY`, `AWAITING_APPROVAL` and `NEEDS_USER_INPUT` are persisted and transition-valid but are not entered by the B1 runtime because B1 has no approval or clarification surface. If a claimed task is in one of those states, the runtime releases the lease and returns `awaiting_human`; it never guesses a decision.

## 5. Lease / claim semantics

`claim_agent_task(p_worker_id, p_lease_seconds)`:

1. Takes a transaction-scoped advisory lock, serializing claims so the caps are exact.
2. Selects one task in a non-terminal, runnable state, `cancel_requested = false`, `deadline_at > now()`, and no active lease, ordered by `created_at`, `FOR UPDATE SKIP LOCKED`.
3. Enforces a per-workspace cap of **2** active leases and a global cap of **20**.
4. Sets a fresh UUID lease token and `lease_expires_at = now() + lease_seconds`.
5. If the task previously had an expired lease, requeues any `RUNNING` step to `PENDING` (crash recovery) and appends `task_lease_reclaimed`.
6. Appends `task_claimed` and returns the task row.

`heartbeat_agent_task` extends a live lease and reports `cancel_requested`; `release_agent_task` clears the lease only with the matching token. A stale worker can never heartbeat, record a step, or transition a task owned by another lease.

`reap_agent_tasks()` is the watchdog:
- non-terminal task with `deadline_at <= now()` ⇒ `FAILED`, evidence `{ reason: "deadline_exceeded", deadline_at, steps_completed }`, lease cleared, `task_failed` event;
- non-terminal task with `cancel_requested = true` and no active lease ⇒ `CANCELLED`, lease cleared, `task_cancelled` event.

## 6. Runtime contract

`lib/agent/runtime.ts` exposes `runAgentTaskOnce(store, environment, options)`:

1. **Gate first.** If `AGENT_RUNTIME_ENABLED` is not exactly `true`, or the process is production (`NODE_ENV=production` or `VERCEL_ENV=production`), return `disabled` without touching the store.
2. **Claim one task.** No task ⇒ `idle`.
3. **Deadline check** before any step. Expired ⇒ `FAILED` with evidence.
4. **Plan once.** If no steps exist, create a deterministic bounded mock plan (`max_steps`, default 25). Transition `INTAKE → PLANNING → EXECUTING`.
5. **Step loop.** Before every step: refresh the task, check `cancel_requested`, check the deadline, heartbeat, and select the first non-terminal step. Execute `mock.echo` with a per-step timeout (default 5 s), record `RUNNING` then `SUCCEEDED` (or `FAILED`), and append a durable event. A `SUCCEEDED` step is never re-executed.
6. **Finish.** All steps done ⇒ `EXECUTING → VERIFYING → COMPLETE`.
7. **Always release** the lease in `finally`; a lost lease ends the run with `lease_lost` and no further writes.

Cancellation is cooperative: the cancel flag is checked between steps and on every heartbeat. The runtime does not kill a step mid-execution; the watchdog and lease expiry bound orphaned work.

## 7. RLS and grants

- RLS enabled on all four tables.
- Authenticated users get `SELECT` only, through policies `using (public.is_workspace_member(workspace_id))`. No `INSERT`/`UPDATE`/`DELETE` policy exists for authenticated users.
- `service_role` gets the table privileges and RPC execution needed by the server-only runtime.
- A dedicated `nexa_agent_runtime` role is created `NOLOGIN NOINHERIT NOBYPASSRLS`, with:
  - `USAGE` on schema `public`;
  - `SELECT` on the four agent tables;
  - `EXECUTE` on the lease/transition/record/reap RPCs;
  - **no** grants on existing business tables and no permission-table write access.
- `request_agent_task_cancel(uuid)` is the only agent RPC granted to `authenticated`; it verifies `owner`/`admin`/`operator` (or the task creator) before setting the flag.
- All other agent RPCs are revoked from `public`, `anon`, and `authenticated`, then granted only to `service_role` and `nexa_agent_runtime`.

## 8. SSE and console

- `GET /api/agent/tasks/[id]/events` requires an authenticated session, validates the task UUID, and confirms the task is visible through the caller’s RLS-scoped client. Disabled flag ⇒ `404` fail-closed.
- The stream sends `retry: 3000`, replays events after `Last-Event-ID` (or `?after=`), polls every 1 s for up to 30 s, emits keep-alive comments, and closes cleanly on abort. It is a skeleton, not a pub/sub replacement.
- `app/settings/agent-runtime/page.tsx` is a server component: auth required, RLS-scoped task list, state chips, deadline, failure reason, and an explicit read-only notice. It has no create/cancel/approve controls.
- Sidebar gains an “Agent runtime” entry under the settings group.

## 9. Test plan (offline, no new dependencies)

| Area | Test |
|---|---|
| FSM | every allowed transition, terminal-state lockout, deadline evaluation, bounded mock plan |
| Gate / kill switch | absent/false/ambiguous values off; exact `true` only outside production; production hard-off; disabled runtime never touches the store |
| Runtime | happy path; crash recovery resumes at the first non-terminal step without re-running completed steps; deadline ⇒ `FAILED` with evidence; per-workspace cap 2; global cap; cancel before claim; cancel between steps; cancel race after claim; lease loss; step timeout |
| Migration contract | append-only chain; RLS enablement and select policies; no authenticated writes; event append-only trigger; transition table parity with TypeScript; claim predicates/caps; cancel role guard; watchdog evidence; agent-role grant matrix; service-role-only RPC grants |
| Docs truth | migration count/name and unit-test total updated in `NEXA_HANDOFF.md` and `docs/GO_LIVE.md` |

RLS and grant verification is static contract testing against the packaged SQL (the established repository pattern). No staging or production database is contacted. A disposable local replay, if available in CI, exercises the migration chain without writing to any hosted project.

## 10. Rollback

1. Set `AGENT_RUNTIME_ENABLED=false` (or remove it) — the engine is dormant and the SSE route returns `404`.
2. The console remains a read-only view of any existing rows; it performs no writes.
3. The migration is additive: no existing table, policy, grant, trigger, or function is altered.
4. If a full schema rollback is ever required, drop the four `agent_*` tables in dependency order and the B1 functions/role; this is an owner-approved operation, not part of B1 execution.

## 11. Explicit non-goals

No B2 tool registry, no B3 permission/approval engine, no B4 planner, no B5 memory, no B6 model/provider calls, no B7 browser/computer-use, no B8 dashboards/evals, no B9 product integration. No WhatsApp outbound path, no external network call, no live OAuth, no deploy, no production migration, no new dependency, no embeddings/pgvector.

---

**Status: `B1 DESIGN NOTE COMPLETE — IMPLEMENTATION IN PROGRESS UNDER THE SIGNED B1 INSTRUCTION`**
