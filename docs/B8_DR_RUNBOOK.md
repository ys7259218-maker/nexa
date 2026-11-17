# B8 DISASTER-RECOVERY RUNBOOK — DRAFT FOR OWNER REVIEW

> Operator-prepared draft. It records no owner decision, contains no credentials and authorizes nothing. Every field in Section 3 stays blank until the owner fills it. This file is an annex to `docs/B8_EXECUTION_INSTRUCTION_DRAFT.md` scope item C7 and the `DR-01 … DR-04` rows of `docs/B8_SECURITY_TEST_MATRIX.md`.

**Prepared:** 2026-11-17 (operator — technical drafting only, NOT an owner and NOT an approver)
**Baseline:** B7 merged on remote `main` as `c7304bf`; local checkout `bb3a5df`
**Status:** DRAFT — owner review pending. No drill has been executed against any hosted project.

---

## 1. What this runbook is for

B8's acceptance line includes "restore-drill runbook reviewed". This document is that review artifact. It describes how a **future** restore drill would be run against a **disposable local** environment, what evidence would be captured, and what remains an owner decision.

It deliberately does **not**:

- contain a password, token, service key, connection string or hosted project identifier;
- instruct anyone to replay a drill against production or any hosted project;
- claim that a drill has been performed;
- set RPO, RTO, retention or approval values (those are owner fields, Section 3).

B8 adds **no migration and no table** (scope C9a). The tracked migration set is unchanged at **34** `.sql` files. Recovery therefore only needs to reproduce the existing additive migration chain.

---

## 2. Non-negotiable constraints

1. **Local and disposable only.** A drill targets a throwaway local database or a disposable local project created for the drill, then destroyed. Hosted replay is never part of this runbook.
2. **No production data.** Use synthetic fixtures only. Never copy customer rows, message bodies, page content, tokens or secrets into a drill environment.
3. **Flags stay off.** `AGENT_RUNTIME_ENABLED`, `AGENT_OBSERVABILITY_ENABLED`, `AGENT_VERIFY_EVIDENCE_ENABLED` are absent or not `"true"` for the whole drill unless the owner signs a separate instruction.
4. **Outbound stays off.** `WHATSAPP_OUTBOUND_ENABLED=false`; AI provider stays `mock`.
5. **Evidence is content-free.** Record counts, hashes, timestamps and pass/fail only — never row content.
6. **No hidden defaults.** Where OD-B5 (retention) or OD-B7 (budget ceiling) values would be required, the runbook records `unconfigured` and stops; it never substitutes a value.

---

## 3. Owner decision fields (BLANK — owner fills)

| Field | Value |
|---|---|
| RPO (recovery point objective) | ______ |
| RTO (recovery time objective) | ______ |
| Drill environment owner | ______ |
| Drill reviewer (name) | ______ |
| Reviewer initials | ______ |
| Review date | ______ |
| Decision | `[ ]` Approve `[ ]` Reject `[ ]` Defer |
| Notes / conditions | ______ |

Until this table is complete and signed by the owner, the runbook is unreviewed and `DR-03` does not pass.

---

## 4. Pre-drill checks (offline, safe to run now)

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Working tree and migration set recorded | `git status --short` and `Get-ChildItem supabase/migrations -Filter *.sql` | only known changes; **34** tracked `.sql` files |
| 2 | Unit runner green at the exact head | `npm test` | all tests pass, 0 fail |
| 3 | Threat matrix complete | `npm run check:agent-matrix` | `Agent threat matrix OK` |
| 4 | Documented count matches the runner | `npm run check:documented-count` | documented total equals runner total |
| 5 | Agent offline evaluation green | `npm run eval:agent` | `6/6 cases passed` |
| 6 | Secret scan clean | `npm run check:tracked-secrets` | no tracked secret |
| 7 | No hosted call was made | review command output | no network, no hosted DB, no provider |

If any check fails, the drill does not start.

---

## 5. Drill procedure (future, local disposable environment only)

Owner approval in Section 3 is required before step 1.

1. **Create the disposable target.** Provision a throwaway local database or disposable local project. Record only a synthetic alias such as `local-drill-<date>`, never a host, key or project ref.
2. **Record the migration baseline.** Capture the ordered list of tracked migration file names and their SHA-256 hashes. This is the restore input.
3. **Apply the chain.** Apply every tracked additive migration in filename order with the project's existing local tooling. Record per-migration success/failure.
4. **Seed synthetic fixtures.** Insert synthetic workspace, task, audit and usage rows that cover at least: one non-terminal task, one `COMPLETE` task, one `FAILED` task, one audit row per status and one usage row. Record counts only.
5. **Capture pre-restore evidence.** Export row counts and a content-free digest per table (counts + sorted ids, hashed). Store the hashes in the drill record.
6. **Destroy and restore.** Destroy the disposable target, recreate it from the same migration chain, and re-apply the same synthetic fixtures.
7. **Compare.** Recompute the same counts and hashes. A mismatch fails the drill.
8. **Check fail-closed behaviour.** With flags absent, confirm `runAgentTaskOnce` returns `disabled`, the observability routes return 404, and the watchdog route returns 404. Record responses.
9. **Destroy the target.** Remove the disposable database/project and any local volume. Record deletion confirmation.
10. **Write the drill record.** Date, owner alias, migration hashes, fixture counts, hash comparison result, route responses, anomalies. No row content, no secrets.

---

## 6. Expected results and failure handling

| Observation | Meaning | Action |
|---|---|---|
| Counts and hashes match after restore | Restore drill passed | Record pass; owner reviews |
| Any count or hash differs | Restore is incomplete or non-deterministic | Drill fails; do not approve |
| A migration fails to apply on a clean target | Migration chain is not reproducible | Drill fails; escalate to owner |
| Any route answers 200 with flags absent | Gate regression | Stop; treat as a security defect |
| Any instruction or output contains a credential or hosted identifier | Secret-handling defect | Stop; rotate if a real secret leaked |
| OD-B5 or OD-B7 value is needed | Owner decision still pending | Record `unconfigured`; do not invent a value |

---

## 7. Evidence to retain (content-free)

- Git head hash and branch name.
- Ordered migration file names plus SHA-256 hashes.
- Pre/post row counts per table and a digest of sorted ids.
- Command names run and their exit codes.
- Route status codes with flags off.
- Owner-signed Section 3 (only after the owner fills it).

Do **not** retain: row bodies, goals, message text, page content, URLs, tokens, keys, connection strings or hosted project identifiers.

---

## 8. Explicit non-goals

- No automatic failover, replication or backup automation is added by B8.
- No watchdog auto-remediation exists: no requeue, cancel, kill, retry or flag flip (scope C6c).
- No retention policy is enforced while OD-B5 is pending; observability reports `unconfigured`.
- No budget ceiling is enforced while OD-B7 is pending; observability reports `unconfigured`.
- No restore command is claimed as tested. Section 5 is a plan, not an executed drill.

---

## 9. Review checklist (for the owner)

- [ ] Section 3 completed and signed.
- [ ] Section 5 starts and ends with a disposable local target.
- [ ] No credentials or hosted identifiers appear anywhere in this file (`DR-01`).
- [ ] No step instructs a hosted replay (`DR-02`).
- [ ] Owner fields were blank before the owner filled them (`DR-03`).
- [ ] Every command named exists in `package.json` (`DR-04`).
