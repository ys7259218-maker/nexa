# Phase B · B2 — Tool Registry & Execution Contracts — Evidence Report

**Status:** implementation complete; verification green; PR not yet created at the time this report was committed.
**Authorization:** owner-signed `docs/OD02_PHASE_B_B2_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, SHA-256 `9C942B629EABAF6B4762F79511091D0B5707FA5E5067C5A96B140E7A132728BE`, signed by the repository owner as `yuvraj singh`, authority `Repository owner SKLD`, date `09/11/2026 - 15:45 - Timezone: PKT` (validity 14 days).
**Base:** `main` @ `68049bdd514d96e732093d5ac5ec6ecd9d6efc44` (B1 merged via PR #232).
**Branch:** `codex/phase-b-b2-tool-registry`.
**Implementation commit:** `1fb72e808311b21ab9c4f5f2bcd0a3d633249e54` — `feat: add Phase B B2 tool registry and execution contracts` (25 files, +4,599/−8).
**Scope:** B2 only. B3–B9 are not started or authorized by this evidence.

---

## 1. Scope executed

The signed B2 scope was executed without expanding it:

| Deliverable | Delivered |
|---|---|
| Additive migration | `supabase/migrations/20261109010000_agent_tool_registry_b2.sql` (29th tracked migration) |
| Manifest format | Typed `ToolManifest`: name, version, description, timeout class, max attempts, risk tier, strict input schema, strict output schema |
| Registry load | `lib/agent/tools/registry.ts`; every supplied manifest is validated before a registry exists; no partial registry |
| Strict schema validation | `lib/agent/tools/schema.ts`; reviewed JSON-schema subset, unknown manifest fields and unknown schema keywords rejected, unknown tool arguments/outputs rejected, bounded nesting |
| Error taxonomy | `VALIDATION`, `PERMISSION`, `RATE_LIMIT`, `TIMEOUT`, `UPSTREAM`, `INTERNAL` |
| Timeout / retry policy | `fast` 5 s / 1 attempt, `standard` 30 s / 2 attempts, `long` 120 s / 2 attempts; retry only for `RATE_LIMIT`, `TIMEOUT`, `UPSTREAM` |
| Audit per invocation | Append-only `agent_tool_invocations` + `record_agent_tool_invocation` RPC; one row per attempt, including validation failures; hashes only |
| First tool families | `workspace.file.read`, `web.research.search`, `calendar.events.read` — contracts and deterministic mocks only |
| Feature flag | `AGENT_TOOL_REGISTRY_ENABLED`, exact `"true"` only, hard-off when `NODE_ENV=production` or `VERCEL_ENV=production` |
| RLS fixture | `scripts/verifyAgentToolRegistryRls.sql`, executed by the disposable local replay harness in CI |
| Docs | `docs/PHASE_B_B2_DESIGN_NOTE.md`; documented totals updated to **778** unit tests and **29** migrations |

Supporting modules: `lib/agent/tools/types.ts`, `hash.ts`, `errors.ts`, `schema.ts`, `manifests.ts`, `gate.ts`, `registry.ts`, `audit.ts`, `adapters.ts`, `executor.ts`, `supabaseStore.ts`.

Design rationale, data model, RLS/grant matrix, and rollback are in `docs/PHASE_B_B2_DESIGN_NOTE.md`.

## 2. Boundaries honored

- No deploy, no production access, no hosted-database access, no production or staging migration application. The B2 migration is packaged only and is **not** applied to any hosted project.
- No live OAuth, model-provider, WhatsApp, calendar, browser, filesystem, computer-use, or external-network call. All three adapters are deterministic mocks; the calendar adapter requires an injected read gate and defaults closed.
- WhatsApp outbound remains `false`; no outbound flag, sender, claim path, or agent→WhatsApp send path was added or changed.
- No existing appointment, WhatsApp, calendar, outbound, auth, or RLS gate was modified. The migration is additive and alters no existing table, policy, grant, trigger, or function.
- No new dependency: `package.json` changed only to register the six new test files. `package-lock.json` is unchanged. No embeddings or pgvector.
- No direct push to `main`, no force-push, no history rewrite, no guard weakening. PR creation and merge remain owner-controlled.
- The operator did not sign, date, initial, or approve any instrument. The signed B2 instruction is the sole authorization; the operator did not edit the signed file.
- Root strays `page.tsx`, `route.ts`, `.codex-worktrees/`, the B1 instruction copies, and the signed B2 instruction remain untouched and uncommitted.

## 3. Security contract

- RLS is enabled on both new tables. Authenticated users receive `SELECT` only, scoped by `public.is_workspace_member(workspace_id)`; there is no authenticated insert/update/delete policy or table grant.
- `service_role` and the dedicated `nexa_agent_runtime` role receive select-only table access. Neither receives direct insert/update/delete table grants; every write goes through a reviewed `SECURITY DEFINER` RPC with `search_path = ''`.
- `record_agent_tool_invocation` and `upsert_agent_tool_manifest` are revoked from `public`, `anon`, and `authenticated`, then granted only to `service_role` and `nexa_agent_runtime`.
- Invocation rows are append-only through a `BEFORE UPDATE OR DELETE` trigger that raises. The unique key `(workspace_id, invocation_key, attempt)` prevents duplicate attempt rows.
- The invocation RPC requires an enabled workspace manifest whose `manifest_hash` matches the supplied hash; otherwise it returns `manifest_missing`. A task or step reference that belongs to another workspace returns `task_workspace_mismatch` or `step_workspace_mismatch`.
- The manifest RPC rejects unknown top-level fields, malformed names/versions/hashes, unreviewed timeout classes, unreviewed risk tiers, non-object schemas, and missing required fields before any upsert.
- The registry hard-fails closed on an absent, invalid, unknown, duplicate, disabled, or hash-drifted manifest, and on a store error or empty result. There is no best-effort execution path.
- The kill switch is checked before any manifest validation or store access. The only enabling value is the exact string `"true"`; production builds and production Vercel environments are hard-off.
- The executor validates input before calling an adapter and validates output before reporting success. An output contract violation is `INTERNAL`, never success. An audit write failure fails the invocation closed.
- Audit rows carry only workspace/task/step ids, tool name/version, manifest hash, timeout class, argument hash, output hash, status, error class, attempt, and duration. Raw tool arguments and outputs are never persisted.
- `lib/agent/tools/boundary.test.ts` statically proves that tool source files contain no `fetch`, `node:fs`, `node:http(s)`, `node:net`, `node:tls`, `child_process`, `axios`, `undici`, `googleapis`, `openai`, WhatsApp, `XMLHttpRequest`, or `WebSocket` call.

## 4. Tests added

51 new tests in six files, all registered in the explicit `package.json` test list:

| File | Tests | Coverage |
|---|---:|---|
| `lib/agent/tools/schema.test.ts` | 9 | reviewed manifests, unknown manifest/input/output fields, types, bounds, patterns, enums, malformed schemas, date-time/HTTPS URI formats, canonical hash stability, depth limit, deterministic fuzz corpus |
| `lib/agent/tools/registry.test.ts` | 11 | exact-`true` flag, ambiguous values off, production hard-off, reviewed load, missing/duplicate/invalid manifests, kill-switch drill with a throwing store, workspace load, empty/errored stores, hash drift, unreviewed tools, disabled rows |
| `lib/agent/tools/executor.test.ts` | 12 | success, content-free audit row, validation failure without adapter call, unknown tool, closed calendar gate, rate-limit retry, timeout, upstream exhaustion, non-retryable internal failure, output contract violation, audit-write failure, invalid invocation key, reviewed timeout/retry policy |
| `lib/agent/tools/adapters.test.ts` | 7 | deterministic file metadata, direct-call validation, deterministic `.invalid` web results, closed-by-default calendar gate, open-gate mock events, inverted time window, exact adapter key set |
| `lib/agent/tools/boundary.test.ts` | 3 | no direct network/filesystem/provider call, adapters free of filesystem/network imports, executor delegates only through adapter and audit contracts |
| `lib/agent/tools/migrationContract.test.ts` | 9 | transactional/additive SQL, exactly two tables, select-only RLS, append-only trigger and sequence-safe key, manifest/audit constraints, full error taxonomy, `SECURITY DEFINER` + empty search path, manifest/task/step matching, RPC-only writes, worker/service grant matrix |

`lib/workspaceMigrations.test.ts` now includes the B2 migration in `expectedMigrationChain`. Documented totals were updated to **778** unit tests and **29** tracked migrations in `NEXA_HANDOFF.md` and `docs/GO_LIVE.md`.

Two signed test obligations are explicitly evidenced:

- **RLS cross-tenant fixtures:** `scripts/verifyAgentToolRegistryRls.sql` is a rollback-only two-tenant fixture executed by the existing disposable local replay harness (`scripts/verifyLocalSupabase.ts`) after both canonical migration replays. It creates two auth users and their personal workspaces, writes one reviewed manifest per tenant through `upsert_agent_tool_manifest`, records one complete invocation per tenant through `record_agent_tool_invocation`, and switches to the `authenticated` role with each user's JWT claims. It asserts each tenant sees exactly its own manifest and invocation and no cross-tenant row; cross-tenant task/step references and a mismatched manifest hash are rejected; unknown manifest fields are rejected; update and delete on the audit table raise; authenticated/anon table privileges are select-only; the authenticated role cannot execute either mutation RPC; and the worker role has select-only tool-table access with no business-table reads and execute only on the reviewed RPCs. Every synthetic row is rolled back, and the post-probe emptiness check now covers both tool tables.
- **Kill-switch drill:** `lib/agent/tools/registry.test.ts` test `kill-switch drill: disabled workspace load never touches the store` passes a throwing proxy store with the flag off and proves the store is never accessed. The same file covers ambiguous flag values and production hard-off.

## 5. Verification at the implementation head

Full repository gate: `npm run check` — **exit 0** at the exact content committed as `1fb72e8`.

| Check | Result |
|---|---|
| Tracked-secret guard | passed, no secrets in tracked files |
| Production-build guard | passed |
| Documented count | 778 matches the runner (pass 778, fail 0) |
| Lint | 0 errors, 16 pre-existing warnings (none from B2 files) |
| Typecheck | clean |
| Unit tests | **778 pass, 0 fail** (727 before B2; +51) |
| Issue-report tests | 0 failures |
| Build | Next.js 16.4.5, compiled successfully, 44 routes |

Verification log: `%TEMP%\opencode\b2-full-check.log` (server-local, 237,528 bytes), SHA-256 `D69638998D46EED5594B420B8C6D17FDE4CCB291AABF613020F7211CD6A91E78`. A standalone test-only run is also recorded at `%TEMP%\opencode\b2-tests-2.log` with 778 pass / 0 fail.

### Local replay limitation

The B2 migration and `scripts/verifyAgentToolRegistryRls.sql` could not be executed on this Windows/OneDrive checkout. Docker Desktop's Linux engine pipe (`npipe:////./pipe/dockerDesktopLinuxEngine`) is unavailable, and the known OneDrive cloud-placeholder `UNKNOWN: unknown error, read` failure blocks `supabase db start` on this checkout. The probe is wired unconditionally into `scripts/verifyLocalSupabase.ts`, which is executed by the CI `Local migration replay` job from a clean Linux checkout; a failed assertion blocks that job.

The PR #233 `Local migration replay` job subsequently **passed at head `5b0fe7a` in 2m34s**. The job applied the full 29-migration chain twice, including `20261109010000_agent_tool_registry_b2.sql`, executed the B2 probe unconditionally after the B1 probe, and passed the post-probe emptiness check. Job: `https://github.com/ys7259218-maker/nexa/actions/runs/42601657790/job/129107355617`. CI replay log: `%TEMP%\opencode\b2-ci-replay.log` (server-local, 330,760 bytes), SHA-256 `2B0FE9319B3ED07B15196D7C35FB995E1A316002DF9521DEB490D8963FEBB27C`.

## 6. Rollback

1. Set `AGENT_TOOL_REGISTRY_ENABLED=false` or remove it; the registry stays dormant, the gate returns `flag_off`, and no tool can execute.
2. The two tables are additive and remain inert. No existing table, policy, grant, trigger, or function is altered.
3. If a full schema rollback is ever required, drop `agent_tool_invocations` and `agent_tool_manifests` and the B2 functions in dependency order; this is an owner-approved operation and was not performed in B2.

## 7. Open items

- The B2 migration is not applied to any hosted project; applying it is outside B2.
- B2 delivers the registry, contracts, mocks, executor, and audit store. Wiring the executor into the B1 worker loop, and any real tool adapter, is outside B2 and requires a later signed instruction.
- The local replay probe runs in CI rather than on this checkout because the local Docker/OneDrive environment is unavailable; the limitation and the passing CI replay at `5b0fe7a` are recorded above. This report update is docs-only.
- PR creation and merge remain owner-controlled. This report is committed before PR creation, as required.

---

**Status: `B2 IMPLEMENTATION COMPLETE — VERIFICATION GREEN — CI REPLAY PASSED — AWAITING OWNER PR MERGE`**
