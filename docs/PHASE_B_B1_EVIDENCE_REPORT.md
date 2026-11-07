# Phase B · B1 — Agent Runtime Foundation — Evidence Report

**Status:** implementation complete; verification green; PR not yet created at the time this report was committed.
**Authorization:** owner-signed `docs/OD02_PHASE_B_B1_EXECUTION_INSTRUCTION_SIGNED.md`, SHA-256 `E49CDEC62BCE429261C600F312FD7BEB56C546B2C0D00B8534DD8749F7ABCEE8`, signed 08/11/2026 00:39 PKT (validity 14 days).
**Base:** `main` @ `6093a31eeb18c00bc3607764dbe67743ee90288d` (Stage F, PR #230).
**Branch:** `codex/phase-b-b1-agent-runtime`.
**Implementation commit:** `55002d3` — `feat: add Phase B B1 agent runtime foundation` (23 files, +4,888/−6).
**Scope:** B1 only. B2–B9 are not started or authorized by this evidence.

---

## 1. Scope executed

The signed B1 scope was executed without expanding it:

| Deliverable | Delivered |
|---|---|
| Additive migration | `supabase/migrations/20261108010000_agent_runtime_b1.sql` (28th tracked migration) |
| Sessions / tasks / steps / events | Four additive `public.agent_*` tables with composite workspace-safe foreign keys |
| Task FSM | `lib/agent/fsm.ts` + SQL `agent_task_transition_allowed`, kept in parity by a contract test |
| Lease / claim | Atomic `claim_agent_task`, `heartbeat_agent_task`, `release_agent_task`; per-workspace cap 2, global cap 20 |
| Cooperative cancel | `request_agent_task_cancel` (authenticated 1-arg wrapper + service 2-arg form) |
| Timeout / watchdog | Runtime per-step timeout and `reap_agent_tasks` deadline/abandoned-cancel reaper with evidence |
| Mock-executed steps | Deterministic `mock.echo` plan only; no provider, network, filesystem, browser, or messaging call |
| SSE skeleton | `GET /api/agent/tasks/[id]/events` |
| Read-only console | `app/settings/agent-runtime/page.tsx`; no create/cancel/approve/retry controls |
| Navigation | `components/dashboard/Sidebar.tsx` gains an “Agent runtime” entry |
| Flag | `AGENT_RUNTIME_ENABLED`, exact `"true"` only, hard-off when `NODE_ENV=production` or `VERCEL_ENV=production` |

Supporting modules: `lib/agent/types.ts`, `gate.ts`, `store.ts` (deterministic in-memory store), `runtime.ts`, `rows.ts`, `supabaseStore.ts`, `events.ts`, `queries.ts`.

Design rationale, data model, RLS/grant matrix, and rollback are in `docs/PHASE_B_B1_DESIGN_NOTE.md`.

## 2. Boundaries honored

- No deploy, no production access, no hosted-database access, no production/staging migration application. The B1 migration is packaged only and is **not** applied to any hosted project.
- No live OAuth, model provider, WhatsApp, calendar, browser, or external network call. The only step executor is deterministic `mock.echo`.
- WhatsApp outbound remains disabled; no outbound flag or send path was changed.
- No new dependency: `package.json` changed only to register the five new test files. `package-lock.json` is unchanged. No embeddings or pgvector.
- No direct push to `main`, no force-push, no history rewrite, no guard weakening. The owner merges the B1 PR.
- The operator did not sign, date, initial, or approve any instrument. The signed B1 instruction is the sole authorization.

## 3. Security contract

- RLS is enabled on all four tables. Authenticated users receive `SELECT` only, scoped by `public.is_workspace_member(workspace_id)`; no authenticated insert/update/delete policy or table grant exists.
- Events are append-only through a `BEFORE UPDATE` trigger that raises; per-task `seq` is assigned under a task row lock in `append_agent_event`.
- Every mutation path is a reviewed `SECURITY DEFINER` RPC with `search_path = ''`.
- `request_agent_task_cancel(uuid)` is the only agent RPC granted to `authenticated`; it requires the task creator or an `owner`/`admin`/`operator` role.
- All other agent RPCs are revoked from `public`, `anon`, and `authenticated`, then granted to `service_role` and the dedicated `nexa_agent_runtime` role.
- `nexa_agent_runtime` is `NOLOGIN NOINHERIT NOBYPASSRLS`, has schema usage, select-only access to the four agent tables, and execute only on the reviewed RPCs; it has no business-table grants and no permission-table writes.
- Claim selection requires a runnable non-terminal state, `cancel_requested = false`, a future deadline, and no active lease; expired leases are reclaimed with `FOR UPDATE SKIP LOCKED` and a `task_lease_reclaimed` event. Stale workers cannot heartbeat, record a step, or transition a task.
- `transition_agent_task` rejects expired leases, non-allow-listed transitions, state mismatches, and non-cancel transitions after a cancel request. `record_agent_step` rejects expired leases, terminal steps, re-running a `SUCCEEDED` step, and a sixth attempt (`attempts_exhausted`).
- The SSE route returns `404` when the flag is off or in production, `401` when unauthenticated, and `404` for a malformed id, missing client, or task not visible through the caller’s RLS-scoped client. Event payloads carry ids, states, counts, and reason codes only.

## 4. Tests added

34 new tests in five files, all registered in the explicit `package.json` test list:

| File | Tests | Coverage |
|---|---:|---|
| `lib/agent/fsm.test.ts` | 5 | transition matrix, terminal lockout, guards, deadline evidence, step summaries/selection, bounded mock plan |
| `lib/agent/gate.test.ts` | 4 | exact-`true` flag, ambiguous values off, production hard-off, labels |
| `lib/agent/events.test.ts` | 4 | Last-Event-ID parsing, SSE framing, retry/comment bounds, abortable sleep |
| `lib/agent/runtime.test.ts` | 13 | disabled gate, idle paths, happy path, crash recovery, deadline failure, workspace/global caps, cancel before/between/racing a step, lease loss, step timeout, human-state release |
| `lib/agent/migrationContract.test.ts` | 8 | additive/transactional SQL, select-only RLS, state/event allow-list parity, FSM parity, claim/heartbeat/transition/step fail-closed predicates, cancel role guard, watchdog evidence, append-only events, least-privilege grants |

`lib/workspaceMigrations.test.ts` now includes the B1 migration in `expectedMigrationChain`. Documented totals were updated to **727** unit tests and **28** tracked migrations in `NEXA_HANDOFF.md` and `docs/GO_LIVE.md`.

## 5. Verification at the implementation head

Full repository gate: `npm run check` — **exit 0**.

| Check | Result |
|---|---|
| Tracked-secret guard | passed, no secrets in tracked files |
| Production-build guard | passed |
| Documented count | 727 matches the runner (pass 727, fail 0) |
| Lint | 0 errors, 16 pre-existing warnings (none from B1 files) |
| Typecheck | clean |
| Unit tests | **727 pass, 0 fail** (693 before B1; +34) |
| Issue-report tests | 5 pass, 0 fail |
| Build | Next.js 16.4.5, compiled successfully, 44 routes |
| New routes in build | `/api/agent/tasks/[id]/events`, `/settings/agent-runtime` |

Verification log: `%TEMP%\opencode\b1-full-check-2.log` (server-local), SHA-256 `C64CA5C95CE605D7BE23242377A2F526E268822D5B3DBDEF2293E48AA3DB88A2`.

### Build incident and resolution

The first full gate failed during `next build` while Turbopack read `node_modules/lucide-react/dist/esm/icons/workflow.mjs`: the file is an unavailable OneDrive cloud placeholder (`os error 362`, cloud file provider not running). This was an environment/filesystem failure, not a code or type error. The sidebar entry was changed to reuse the already-imported `Activity` icon, so the build imports no new package file. The exact build then passed, followed by a complete green `npm run check` from the top. No dependency, guard, or verification step was changed.

## 6. Rollback

1. Set `AGENT_RUNTIME_ENABLED=false` or remove it; the runtime stays dormant and the SSE route returns `404`.
2. The console remains a read-only view of existing rows and performs no writes.
3. The migration is additive: no existing table, policy, grant, trigger, or function is altered.
4. A full schema rollback (drop the four `agent_*` tables and B1 functions/role in dependency order) is an owner-approved operation and was not performed in B1.

## 7. Open items

- The B1 migration is not applied to any hosted project; applying it is outside B1.
- The worker process that will call `createSupabaseAgentStore` does not exist yet; B1 delivers the store contract, schema, and runtime loop only.
- PR creation and merge remain owner-controlled. This report is committed before PR creation, as required.

---

**Status: `B1 IMPLEMENTATION COMPLETE — FULL GATE GREEN — AWAITING OWNER PR MERGE`**
