# B8 SECURITY TEST MATRIX — proposal for the B8 execution instruction

> Operator-prepared test design. It authorizes nothing and records no owner decision. It is an annex to `docs/B8_EXECUTION_INSTRUCTION_DRAFT.md` and is only meaningful once the B8 prerequisite row C0a (or full OD-B5/OD-B7 decisions) and the signed B8 instruction exist.

**Prepared:** 2026-11-16
**Baseline:** B7 merged on remote `main` as `c7304bf`; local checkout `bb3a5df`
**Rule:** every case runs offline against in-memory stores and the **mock** browser driver. No network, no hosted DB, no real browser, no provider call, no new migration.

---

## 1. Why this annex exists

The blueprint's B8 acceptance line is three clauses: "every milestone's security test pack re-runs green; dashboards show tier/cost/evidence aggregates; restore-drill runbook reviewed." That is not testable as written. This matrix turns it into concrete, fail-closed cases so implementation and review agree on what "done" means - and so the new observability surface cannot become a data-leak or privilege-escalation path.

---

## 2. Cases

### 2.1 Eval harness determinism and offline discipline (draft scope C1)

| ID | Scenario | Expected (fail closed) | Evidence |
|---|---|---|---|
| EH-01 | Any eval run in a clean environment | Zero network sockets and zero `fetch` calls; no hosted URL required | transport spy / empty-env run |
| EH-02 | Two runs with identical injected clock and id factory | Byte-identical result JSON | two snapshots compared |
| EH-03 | Import graph of `lib/agent/eval/*` | Does not import providers, WhatsApp/outbound, calendar, Supabase server clients, or the Playwright driver | import-graph assertion |
| EH-04 | One suite returns failures | Run status `failed`, exit code non-zero, per-case codes retained | exit code + result JSON |
| EH-05 | One fixture throws | Recorded as `error` for that case; other suites still run; overall run fails | result JSON |
| EH-06 | Result output inspected | No fixture text, customer text, secret or page content; ids/counts/codes only | schema + string scan |
| EH-07 | Run with every hosted/env variable absent | Completes without attempting a DB or provider connection | empty-env run |

### 2.2 Scenario packs (draft scope C2)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| SC-01 | B1 happy path | INTAKE -> PLANNING -> EXECUTING -> VERIFYING -> COMPLETE with in-memory store | state/event trace |
| SC-02 | Lease lost mid-run | `lease_lost`; step idempotency keys prevent duplicate execution | step invocation counts |
| SC-03 | Deadline exceeded | `FAILED` with `deadline_exceeded`; no further steps | state trace |
| SC-04 | Cancellation requested | `CANCELLED`; no step runs after the cancel is observed | state trace |
| SC-05 | B3 T4 action without approval | Blocked before execution; approval-required decision recorded | permission decision |
| SC-06 | B7 mock browser: off-list URL, then approved in-list act | Off-list denied before driver call; in-list act allowed only with approval and evidence descriptor | driver call log + descriptor |

### 2.3 VERIFYING evidence checks (draft scope C4)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| VE-01 | Hook absent (flag off) | `runAgentTaskOnce` performs exactly the same store calls as baseline | call-count comparison |
| VE-02 | Terminal/step-succeeded event missing | Check fails; task does not reach COMPLETE | checker result |
| VE-03 | Side-effecting step without an audit row | Check fails | checker result |
| VE-04 | Complete event, step and audit evidence present | COMPLETE allowed | checker result |
| VE-05 | Checker throws or times out | `FAILED` (fail closed), never COMPLETE | state trace |
| VE-06 | Evidence reference belongs to another workspace | Check fails; no cross-workspace read | denial reason |

### 2.4 Observability aggregates and route (draft scope C5)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| OB-01 | `AGENT_OBSERVABILITY_ENABLED` unset/false | Route 404, no store read | response + store spy |
| OB-02 | `VERCEL_ENV=production` with the flag `true` | 404 (production hard-off) | response |
| OB-03 | Unauthenticated request | 401 | response |
| OB-04 | Authenticated user outside the workspace / unknown workspace | 404 with a uniform body (no existence signal) | response |
| OB-05 | Response schema | Content-free: no args, outputs, URLs, page text, customer text or secrets; ids/counts/durations/hashes only | schema + scan |
| OB-06 | Fixed audit fixture | Correct status counts, error-class counts, tier mix, p50/p95 durations | expected object equality |
| OB-07 | Empty store | All zeros with an explicit `data_complete: true`; no error | response |
| OB-08 | Store read error | Typed failure / 503; no fabricated numbers | response |

### 2.5 Advisory watchdog (draft scope C6)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| WD-01 | Lease older than the configured staleness threshold | `stale_lease` alert with task id | alert list |
| WD-02 | Lease inside the threshold | No alert | alert list |
| WD-03 | Task in VERIFYING beyond the configured window | `stuck_verifying` alert | alert list |
| WD-04 | Budget usage above a configured ceiling | `budget_breach` alert using the configured value | alert list |
| WD-05 | No ceiling configured (OD-B7 pending) | Status `unconfigured`; no invented default, no alert | alert list |
| WD-06 | Any watchdog evaluation | Zero writes/mutations; no requeue, cancel, retry or flag flip | mutation spy |
| WD-07 | Watchdog route gate/auth/RLS | Identical to OB-01..OB-04 | responses |

### 2.6 Threat-matrix integrity check (draft scope C3)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| MT-01 | Mapped case -> file that does not exist | `check:agent-matrix` fails with the missing path | exit code |
| MT-02 | Mapped file exists but is absent from the `test` script | Check fails | exit code |
| MT-03 | Known security test file not mapped, or a duplicate/mismatched case id | Check fails | exit code |

### 2.7 DR runbook (draft scope C7)

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| DR-01 | Runbook scanned | No credentials, tokens, connection strings or hosted project identifiers | text scan |
| DR-02 | Drill steps checked | Target a local disposable DB/project only; hosted replay never instructed | review |
| DR-03 | Owner fields | RPO, RTO, review date and approval remain blank until the owner fills them | blank check |
| DR-04 | Referenced commands | Exist in `package.json`/repo and are the ones verified in Section I | command lookup |

---

## 3. Gate mapping

| Draft row | Cases |
|---|---|
| C0 prerequisite handling | WD-05, DR-03 |
| C1 eval harness | EH-01 ... EH-07 |
| C2 scenario packs | SC-01 ... SC-06 |
| C3 threat-matrix automation | MT-01 ... MT-03 |
| C4 VERIFYING evidence checks | VE-01 ... VE-06 |
| C5 observability aggregates/route | OB-01 ... OB-08 |
| C6 watchdog | WD-01 ... WD-07 |
| C7 DR runbook | DR-01 ... DR-04 |
| C9 no-new-table | all cases run without any migration applied |

All 41 cases must be green in `npm test` (plus `eval:agent` and `check:agent-matrix`) before a B8 PR is opened. A full B1-B7 matrix re-run is `npm test` at the PR head; nothing is "re-run" by citing older logs.

---

## 4. Open design points for the owner

These are called out rather than silently decided:

1. **Watchdog thresholds:** proposed starting points are stale lease = 2x `AGENT_DEFAULT_LEASE_SECONDS` (120s) and stuck VERIFYING = 10 minutes. These are configuration parameters, not code constants; confirm or replace.
2. **Metrics route exposure:** proposal keeps `GET /api/agent/observability/*` authenticated and flag-gated now, with no UI until B9.
3. **`check` composition:** proposal appends `check:agent-matrix` to `npm run check` (cheap static check) while `eval:agent` stays a required manual/CI step because it is heavier.
4. **Evidence-check failure mode:** proposal is `FAILED` on missing evidence, not retry. If retry is preferred, it needs its own attempt bound and test rows.
5. **DR review cadence and RPO/RTO:** owner values, left blank in the runbook draft.
6. **B7 `target_mismatch`/redirect rows:** B8 replays only the mock cases already merged in B7; it does not add browser DNS or hosting cases (those stay with OD-B4).

**Status:** `B8 SECURITY TEST MATRIX PROPOSED — 41 CASES — NO OWNER DECISION RECORDED — NO B8 CODE`
