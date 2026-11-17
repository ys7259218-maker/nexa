# AGENT EVALUATION & OBSERVABILITY — B8 OPERATOR GUIDE

> Operator documentation for the B8 surfaces. It records no owner decision, authorizes nothing and requires no network, hosted database, provider, browser binary or new migration.

**Prepared:** 2026-11-17
**Baseline:** B7 merged on remote `main` as `c7304bf`; B8 branch `codex/phase-b-b8-eval-observability`
**Scope:** `docs/B8_EXECUTION_INSTRUCTION_DRAFT.md` items C1–C9; test contract `docs/B8_SECURITY_TEST_MATRIX.md` (41 cases).

---

## 1. What B8 adds

| Area | Entry point | Default |
|---|---|---|
| Offline eval runner | `lib/agent/eval/` | always available, no flags |
| Scenario packs (B1/B3/B4/B5/B7) | `lib/agent/eval/scenarios.ts` | run via `npm run eval:agent` |
| Threat-matrix check | `lib/agent/eval/threatMatrix.ts` + `scripts/checkAgentThreatMatrix.ts` | `npm run check:agent-matrix` |
| VERIFYING evidence checks | `lib/agent/verify/evidenceChecks.ts`, runtime hook | **off** unless a hook is passed |
| Observability summary | `GET /api/agent/observability/summary` | **404** unless double-gated on |
| Advisory watchdog | `GET /api/agent/observability/watchdog` | **404** unless double-gated on |

B8 adds **no migration and no table**. The tracked migration set stays at **34** `.sql` files.

---

## 2. Offline evaluation

```text
npm run eval:agent
```

- Deterministic: fixed clock and fixed id factory, so two runs produce identical result JSON.
- Offline: no `fetch`, no network socket, no hosted URL, no provider, no real browser. The browser scenario uses the mock driver only.
- Content-free output: suite id, case id, pass/fail, failure codes, counts. Never fixture text, page content, customer text or secrets.
- Exit code is non-zero if any case fails. A fixed input is expected to print `6/6 cases passed` for `SC-01 … SC-06`.

`SC-01` replays the B1 lifecycle, `SC-02` lease loss, `SC-03` deadline failure, `SC-04` cancellation, `SC-05` the B3/B4/B5 fail-closed pack, and `SC-06` the B7 mock-browser allow-list and approval flow.

---

## 3. Threat-matrix check

```text
npm run check:agent-matrix
```

`lib/agent/eval/threatMatrix.ts` maps every known security test file to a stable case id:

- `B1-01 … B6-04` for milestones that never had per-case ids;
- the literal B7 ids (`SP`, `EV`, `AP`, `SL`, `MF`, `DG`) for the 37 B7 cases;
- `B8_OWN_TEST_FILES` for B8's own tests, including both routes.

The checker reads the real working tree and `package.json`, then fails on:

| Code | Meaning |
|---|---|
| `missing_file` | a mapped test file does not exist |
| `unregistered_file` | a mapped file is absent from the `test` script |
| `orphaned_file` | a `lib/agent/**/*.test.ts` file is not mapped |
| `duplicate_case_id` | the same case id appears twice |
| `invalid_case_id` | the id does not match the accepted pattern |
| `mismatched_milestone` | the id prefix and declared milestone disagree |
| `b8_missing_file` / `b8_unregistered_file` | a B8-owned test (including a route test) is missing or unregistered |

Success prints the mapped-case count, milestone count and B8 test-file count. It is also part of `npm run check`.

---

## 4. VERIFYING evidence hook (scope C4)

`runAgentTaskOnce` accepts an optional `verifyEvidence` hook:

```ts
runAgentTaskOnce(store, environment, {
  workerId,
  verifyEvidence: async ({ task, store }) => ({ ok: true }),
});
```

Rules:

- **Hook absent:** behaviour is unchanged and no extra store read occurs. `VE-01` compares store call counts against the baseline.
- **Hook returns `{ ok: false, reason }`:** the task transitions `VERIFYING → FAILED` with that reason. It never reaches `COMPLETE`.
- **Hook throws:** reported as `evidence_check_error` and the task fails closed.
- **Hook never resolves:** bounded by `AGENT_VERIFY_EVIDENCE_TIMEOUT_MS` (1 000 ms), reported as `evidence_check_timeout`, task fails closed.

`lib/agent/verify/evidenceChecks.ts` provides a pure checker plus `createVerifyEvidenceHook(reader)`. It rejects:

- a task that is not `VERIFYING`;
- a missing `task_completed` or `step_succeeded` event;
- a succeeded side-effecting step (`browser.act`) with no matching successful audit row;
- any pending approval;
- evidence/audit/approval rows from another workspace.

Output is a failure-code list and a hash. No arguments, outputs, URLs or page content cross the boundary.

`AGENT_VERIFY_EVIDENCE_ENABLED` stays **off** in B8. The hook only runs when a caller passes it explicitly.

---

## 5. Observability summary (scope C5)

```text
GET /api/agent/observability/summary
```

Double gate: `AGENT_OBSERVABILITY_ENABLED === "true"` **and** `AGENT_RUNTIME_ENABLED === "true"`.

| Condition | Response |
|---|---|
| Either flag off | `404` before any auth or store read |
| `NODE_ENV=production` or `VERCEL_ENV=production` | `404` (hard-off, even with both flags) |
| Unauthenticated | `401` |
| No RLS-visible workspace / unknown workspace | `404`, uniform body (no existence signal) |
| Store read error | `503` with `{"status":"unavailable"}` and no fabricated numbers |
| Success | `200`, `Cache-Control: no-store, max-age=0` |

Response shape (content-free):

```json
{
  "dataComplete": true,
  "tasks": {
    "total": 0,
    "byStatus": {},
    "byErrorClass": {},
    "byTier": {},
    "durations": { "sampleSize": 0, "p50Ms": null, "p95Ms": null, "maxMs": null }
  },
  "audits": {
    "total": 0,
    "byStatus": {},
    "byErrorClass": {},
    "durations": { "sampleSize": 0, "p50Ms": null, "p95Ms": null, "maxMs": null }
  },
  "budget": {
    "status": "unconfigured",
    "ceilingUsd": null,
    "spentUsd": 0,
    "remainingUsd": null,
    "breached": false
  },
  "retention": { "status": "unconfigured" }
}
```

Reader sources, all RLS-scoped by workspace: `agent_tasks`, `agent_tool_invocations`, `agent_usage_ledger`, and plan tiers via `agent_plan_steps` joined to `agent_plans(task_id)`.

Percentiles use nearest rank: rank = `ceil(p/100 × n)`, clamped to `[1, n]`.

### C0a waiver behaviour

- **Budget:** OD-B7 is pending, so `budgetCeilingUsd` is always `null` and the rollup reports `unconfigured`. No default and no flag-supplied ceiling is invented.
- **Retention:** OD-B5 is pending, so retention reports `unconfigured`. No window is applied or displayed.

Deciding OD-B5/OD-B7 later does not require changing B8 code.

---

## 6. Advisory watchdog (scope C6)

```text
GET /api/agent/observability/watchdog
```

Identical gate, auth and RLS rules (`WD-07`). The report is advisory only: **no requeue, cancel, kill, retry or flag flip** exists anywhere in the module or route.

Thresholds are explicit configuration; missing, empty, non-numeric or non-positive values stay `null` and the corresponding check is reported as `unconfigured` rather than given a hidden default.

| Environment variable | Check |
|---|---|
| `AGENT_WATCHDOG_STALE_LEASE_SECONDS` | lease held beyond N seconds |
| `AGENT_WATCHDOG_STUCK_VERIFYING_SECONDS` | task in `VERIFYING` beyond N seconds |
| `AGENT_WATCHDOG_CONSECUTIVE_FAILURES` | N consecutive failed tasks |
| `AGENT_WATCHDOG_BUDGET_CEILING_USD` | spend above the configured ceiling |

Report shape:

```json
{
  "status": "ok | alert | unconfigured",
  "alerts": [{ "kind": "stale_lease", "taskId": "…", "threshold": 120 }],
  "unconfigured": ["budget_breach", "repeated_failures", "stale_lease", "stuck_verifying"],
  "thresholds": {
    "staleLeaseSeconds": null,
    "stuckVerifyingSeconds": null,
    "consecutiveFailures": null,
    "budgetCeilingUsd": null
  }
}
```

`status` is `alert` when any alert exists, otherwise `unconfigured` when any check lacks a threshold, otherwise `ok`.

---

## 7. Verification commands

| Command | What it proves |
|---|---|
| `npm test` | full registered unit runner, including every B8 test |
| `npm run eval:agent` | `SC-01 … SC-06` pass offline and deterministically |
| `npm run check:agent-matrix` | B1–B7 mapping complete; B8 tests registered |
| `npm run check:documented-count` | documented unit-test total matches the runner |
| `npm run typecheck` | no type errors |
| `npm run lint` | 0 errors |
| `npm run check` | full gate, including `check:agent-matrix` |

At this head the runner reports **1045** tests, 0 failures.

---

## 8. Rollback and safety

- Turn `AGENT_OBSERVABILITY_ENABLED` off (or remove it): both routes return `404` before auth or store access.
- Leave `AGENT_VERIFY_EVIDENCE_ENABLED` off: the runtime behaves exactly as B7 with no extra store read.
- Production is hard-off regardless of flags.
- The watchdog cannot change state, so there is nothing to roll back for it.

---

## 9. Non-goals

- No dashboard UI, chart or persisted snapshot is added.
- No provider/model/WhatsApp/calendar call is introduced.
- No browser binary is installed and no real browser runs.
- No retention or budget value is decided by code.
