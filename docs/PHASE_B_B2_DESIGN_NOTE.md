# Phase B · B2 — Tool Registry & Execution Contracts — Design Note

**Status:** implementation design for the signed B2 instruction (`docs/OD02_PHASE_B_B2_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, SHA-256 `9C942B62…`, signed 09/11/2026 15:45 PKT).
**Base:** `main` @ `68049bdd514d96e732093d5ac5ec6ecd9d6efc44` (B1 merged via PR #232).
**Branch:** `codex/phase-b-b2-tool-registry`.
**Scope:** B2 only. B3–B9 are not authorized. No deploy, no production access, no live provider/OAuth/WhatsApp/calendar/browser/filesystem calls.

---

## 1. Baseline verified before design

Read-only inspection at the B2 base found:

- B1 already provides the durable agent runtime: `agent_sessions`, `agent_tasks`, `agent_task_steps`, `agent_events`, the atomic lease/claim RPCs, cooperative cancel, the deadline watchdog, and the dedicated `nexa_agent_runtime` role. B1 steps are deterministic mocks only.
- There is no tool manifest, tool registry, schema validator, invocation audit table, or tool execution contract yet.
- Existing gate patterns are self-contained and fail closed: the only enabling value is the exact string `"true"`, and production is hard-off (`lib/agent/gate.ts`, `lib/calendar/googleCalendarGate.ts`).
- The calendar connect flow already has a reviewed gate adapter (`canEnableGoogleCalendar`). B2 reuses that gate as an injected contract; it does not call Google, OAuth, or the network.
- The repository test discipline is explicit: `node --test` with a file list in `package.json`, static migration/RLS contract tests, offline behaviour tests, and documented test/migration counts enforced by `check:documented-count` and `operationalDocsTruth.test.ts`.
- The disposable local replay harness (`scripts/verifyLocalSupabase.ts`) runs rollback-only SQL probes through Docker after two canonical migration replays. CI executes it on a clean Linux checkout.

## 2. B2 deliverables

| Deliverable | Implementation |
|---|---|
| Additive migration | `supabase/migrations/20261109010000_agent_tool_registry_b2.sql` (29th tracked migration) |
| Manifest format | Typed `ToolManifest` with name, version, description, timeout class, max attempts, risk tier, strict input schema, strict output schema |
| Registry load | `lib/agent/tools/registry.ts`; every required manifest is validated before a registry exists |
| Strict schema validation | `lib/agent/tools/schema.ts`; unknown fields rejected, malformed schemas rejected, bounded depth |
| Error taxonomy | `VALIDATION`, `PERMISSION`, `RATE_LIMIT`, `TIMEOUT`, `UPSTREAM`, `INTERNAL` |
| Timeout / retry policy | `fast` 5 s / 1 attempt, `standard` 30 s / 2 attempts, `long` 120 s / 2 attempts |
| Audit per invocation | `agent_tool_invocations` append-only table + `record_agent_tool_invocation` RPC; content-free hashes only |
| First tool families | `workspace.file.read`, `web.research.search`, `calendar.events.read` — contracts and deterministic mocks only |
| Feature flag | `AGENT_TOOL_REGISTRY_ENABLED`, absent/`false` = off; hard-off in production |
| Tests | schema fuzz/unknown-field rejection, registry fail-closed, audit completeness, per-class timeout/retry, static no-direct-API boundary, RLS cross-tenant probe, worker grant matrix, kill-switch drill |

## 3. Data model

Both tables are additive and workspace-scoped. No existing table, policy, grant, trigger, or function is altered.

### `agent_tool_manifests`

`id`, `workspace_id` → `workspaces(id)`, `tool_name`, `tool_version`, `manifest jsonb`, `manifest_hash` (64 hex), `enabled`, `created_by` → `auth.users(id)`, `created_at`, `updated_at`.

Constraints:

- `tool_name` matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$`;
- `tool_version` matches `^[0-9]+\.[0-9]+\.[0-9]+$`;
- `manifest` is an object whose `name`/`version` match the columns;
- `timeoutClass` is `fast`/`standard`/`long`, `maxAttempts` is 1–3, `riskTier` is `T0`/`T1`;
- `inputSchema` and `outputSchema` are objects;
- the manifest has no unknown top-level keys;
- unique `(workspace_id, tool_name, tool_version)`.

Manifests are written only through `upsert_agent_tool_manifest`. Direct table writes are not granted to any API or worker role.

### `agent_tool_invocations`

`id`, `workspace_id` → `workspaces(id)`, optional `task_id`/`step_id` (validated against the same workspace by the RPC), `invocation_key`, `tool_name`, `tool_version`, `manifest_hash`, `timeout_class`, `args_hash`, `output_hash`, `status`, `error_class`, `attempt`, `duration_ms`, `created_at`, `completed_at`.

Constraints:

- hashes are 64 lowercase hex; `args_hash` is always present; `output_hash` is present only for success;
- `status` is `SUCCEEDED`/`FAILED`; `error_class` is null exactly when the status is `SUCCEEDED`;
- `attempt` is 1–3; `duration_ms` is 0–600000;
- unique `(workspace_id, invocation_key, attempt)`;
- a `BEFORE UPDATE OR DELETE` trigger raises, so audit rows are append-only;
- the RPC rejects a `task_id`/`step_id` that belongs to another workspace;
- the RPC rejects an invocation whose `manifest_hash` does not match an enabled workspace manifest.

Audit rows carry only hashes, ids, class names, status, attempt, and duration. Raw tool arguments and outputs are never persisted.

## 4. Manifest and schema contract

A manifest is a reviewed, versioned document. The registry requires all three first-family manifests:

| Tool | Class | Attempts | Risk | Purpose |
|---|---|---:|---|---|
| `workspace.file.read` | `fast` | 1 | T1 | Read metadata for a workspace-storage file |
| `web.research.search` | `standard` | 2 | T1 | Read-only research search |
| `calendar.events.read` | `standard` | 1 | T1 | Read calendar events through the existing gate contract |

The validator implements a strict JSON-schema subset: `type`, `properties`, `required`, `additionalProperties: false`, `enum`, `const`, `minLength`, `maxLength`, `pattern`, `format` (`date-time`, `uuid`, `uri`), `minimum`, `maximum`, `items`, `minItems`, `maxItems`. Unknown schema keywords are rejected. Object schemas must explicitly set `additionalProperties: false`, so unknown tool arguments and unknown mock outputs are rejected.

`validateManifest` rejects unknown manifest fields, duplicate names/versions, malformed hashes, and any schema that cannot be validated. `manifestHash` is the SHA-256 of canonical JSON (recursively sorted object keys, no whitespace), so the same manifest always produces the same hash.

## 5. Registry load and fail-closed rules

`loadToolRegistry(environment, manifests)`:

1. Applies the kill switch first. `AGENT_TOOL_REGISTRY_ENABLED` must be exactly `"true"`; `NODE_ENV=production` or `VERCEL_ENV=production` is hard-off. A disabled gate returns `disabled` without validating or exposing any tool.
2. Validates every supplied manifest. A single invalid manifest fails the whole load; there is no best-effort partial registry.
3. Rejects duplicate `(name, version)` entries.
4. Requires every reviewed first-family manifest to be present.
5. Returns an immutable registry only when all checks pass.

`loadWorkspaceToolRegistry(store, workspaceId, environment)` additionally loads the workspace’s persisted manifests. It fails closed if the store errors, returns no manifests, omits a required tool, contains an invalid manifest, has a hash mismatch, or has a persisted manifest whose hash differs from the reviewed code manifest. The executor never executes a tool whose manifest is absent, invalid, unknown, or whose class policy is missing.

## 6. Execution contract

`executeToolInvocation({ registry, adapters, auditStore }, request)`:

1. Resolve the exact `(toolName, toolVersion)` manifest. Unknown tool/version ⇒ `VALIDATION` and no adapter call.
2. Validate input against the manifest schema. Unknown fields, wrong types, and bound violations ⇒ `VALIDATION`, audited, no adapter call.
3. Run the adapter under the manifest’s timeout class. The adapter receives only the validated input and a context containing the workspace id, invocation key, and clock.
4. Classify adapter failures into the error taxonomy. `RATE_LIMIT`, `TIMEOUT`, and `UPSTREAM` are retryable up to the manifest’s attempt cap; `VALIDATION`, `PERMISSION`, and `INTERNAL` are not.
5. Validate output against the output schema. A contract violation is `INTERNAL` and is not reported as success.
6. Write one append-only audit row per attempt, including validation failures. An audit write failure fails the invocation closed (`INTERNAL`) and never reports success.
7. Return the validated output or the terminal error class, attempt count, and audit ids.

The executor has no network, filesystem, provider, WhatsApp, calendar, browser, or computer-use path. All external effects are behind the injectable `ToolAdapter` contract.

## 7. First-family adapters (contracts and mocks only)

- `createMockFileReadAdapter`: deterministic metadata for a workspace-relative path. It does not import `node:fs` and does not read a real file. The path schema rejects absolute paths and `..` segments before the adapter is called.
- `createMockWebResearchAdapter`: deterministic, reserved `.invalid` result URLs and hashes. It does not call `fetch`.
- `createMockCalendarReadAdapter`: requires an injected `CalendarReadGate`. The default gate is closed; a closed gate yields `PERMISSION`. When open, it returns deterministic mock events. It does not call Google, OAuth, or the network. The real adapter will be wired to the existing calendar gate only under a later owner instruction.

## 8. RLS and grants

- RLS enabled on both new tables.
- Authenticated users get `SELECT` only through `using (public.is_workspace_member(workspace_id))`; no authenticated insert/update/delete policy or table grant.
- `service_role` and `nexa_agent_runtime` get `SELECT` on both tables. They do **not** get direct insert/update/delete table grants; all writes go through the reviewed `SECURITY DEFINER` RPCs.
- `record_agent_tool_invocation(...)` and `upsert_agent_tool_manifest(...)` are revoked from `public`, `anon`, and `authenticated`, then granted only to `service_role` and `nexa_agent_runtime`.
- The worker role gains no business-table access, no permission-table access, and no direct audit write.
- Invocation rows are append-only through a trigger that raises on update or delete.

## 9. Test plan (offline, no new dependencies)

| Area | Test |
|---|---|
| Schema | valid manifests; unknown manifest fields; unknown input/output fields; wrong types; bounds; patterns; enums; malformed schemas; depth limit; canonical hash stability; deterministic fuzz corpus |
| Registry / kill switch | absent/false/ambiguous flag off; exact `true` only outside production; production hard-off; kill-switch drill proves no store access; missing required manifest; invalid manifest; duplicate; workspace store error/empty/hash mismatch |
| Executor | success; validation failure; unknown tool; permission; rate-limit retry; timeout; upstream exhaustion; internal error; output contract violation; audit-store failure; audit completeness and content-free rows; per-class timeout/retry values |
| Adapters | deterministic file metadata; deterministic web results with `.invalid` URLs; calendar closed gate ⇒ `PERMISSION`; open gate ⇒ mock events; no real I/O |
| Boundary | static test that tool source files contain no `fetch`, `node:fs`, `node:http(s)`, `child_process`, `googleapis`, `whatsapp`, or provider SDK call |
| Migration contract | append-only chain; exactly two additive tables; RLS/policies; authenticated select-only; append-only trigger; manifest/audit constraints; RPC validation and manifest matching; worker grant matrix |
| RLS cross-tenant | rollback-only `scripts/verifyAgentToolRegistryRls.sql` run by the disposable local replay; two tenants see only their own manifests/invocations; cross-tenant task/step reference denied; direct writes denied; worker grant matrix checked |
| Docs truth | migration count/name and unit-test total updated in `NEXA_HANDOFF.md` and `docs/GO_LIVE.md` |

## 10. Rollback

1. Set `AGENT_TOOL_REGISTRY_ENABLED=false` or remove it; the registry stays dormant and no tool can execute.
2. The tables are additive and remain inert; no existing table, policy, grant, trigger, or function is altered.
3. If a full schema rollback is ever required, drop the two `agent_tool_*` tables and the B2 functions in dependency order; this is an owner-approved operation, not part of B2 execution.

## 11. Explicit non-goals

No B3 permission/approval engine, no B4 planner, no B5 memory, no B6 model/provider calls, no B7 browser/computer-use, no B8 dashboards/evals, no B9 product integration. No live OAuth, network, model, WhatsApp, calendar, browser, or filesystem call. No deploy, production migration, new dependency, embeddings, or pgvector.

---

**Status: `B2 DESIGN NOTE COMPLETE — IMPLEMENTATION IN PROGRESS UNDER THE SIGNED B2 INSTRUCTION`**
