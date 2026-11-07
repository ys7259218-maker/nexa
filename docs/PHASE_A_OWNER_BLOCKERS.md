# Phase A — Owner Decisions & Release Blockers (Task A9)

**Audit date:** 2026-11-07 · **Mode:** documentation of outstanding owner authorizations. No owner decision is made on the owner's behalf; no signature/authorization is fabricated.

## 1. D7 owner decision matrix (23 decisions, all OPEN)

**Source note:** the controlling D7 documents are NOT in this repository (see `PHASE_A_ARCHITECTURE_BASELINE.md` §5). They lived in the expired snapshot `C:\Users\ys725\AppData\Local\Temp\nexa-snapshot-20261018-2D` and were recovered **verbatim** from local OpenCode session history (boot-time-read-only SQLite/session-store extraction at `Temp\opencode\recover\`). The D7 status quoted here is therefore: **not re-verifiable inside this repo, but corroborated by two independent recovered documents** (`D7_OWNER_AUTHORIZATION_PACKAGE.md` decision table + `D7_OWNER_DECISION_PRIORITY_MATRIX.md` row set) and the prior OD-01 intake report that recorded `OWNER_EVIDENCE_MISSING` (2026-10-23). No new signed owner record exists anywhere; statuses below are quoted, not re-derived.

| ID | Decision | Status | Required owner action | Primary gate | Risk if unresolved |
| --- | --- | --- | --- | --- | --- |
| OD-01 | Accountable owner and authorization authority | OPEN | Name accountable owner, independent reviewers, conflict-of-interest attestation, stop authority | D7-G0 | Every D7 decision and gate blocked at the root |
| OD-02 | Database ownership and target type | OPEN | Authorize the exact disposable local (ephemeral) database target for validation | D7-G0/G8 | No durable-state validation can run |
| OD-03 | Credentials and secrets | OPEN | Authorize credential staging for the disposable run (no secrets in evidence) | D7-G0 | Provisioning cannot be done safely |
| OD-04 | Project/runtime isolation | OPEN | Approve isolated runtime for the validation target | D7-G0 | Cross-contamination of environments |
| OD-05 | Network restrictions | OPEN | Approve network posture for the run | D7-G0 | Unintended egress during validation |
| OD-06 | Test data and identities | OPEN | Approve synthetic identities/data rules | D7-G0/G2/G3 | Privacy exposure if real data sneaks in |
| OD-07 | Harness ownership and review | OPEN | Assign harness author + independent harness reviewer | D7-G8 | Harness evidence inadmissible (self-review) |
| OD-08 | Cleanup | OPEN | Approve teardown/cleanup procedure | D7-G8 | Residual local state, re-run disagreement |
| OD-09 | Evidence retention | OPEN | Approve retention window and storage of redacted/hashed evidence | D7-G8/G9 | Evidence unauditable |
| OD-10 | Teardown verification | OPEN | Approve teardown verification steps | D7-G8 | "Cleaning up" unproven |
| OD-11 | Memory scope and migration order | OPEN | Sign v2 memory inclusion, exact migration order, four hashes, adapter contract | D7-G4 | Migration disorder breaks FK/replay |
| OD-12 | Privileged direct DML and audit coupling | OPEN | Decide direct-DML vs RPC-only model + audit boundary | D7-G2 | Audit gaps → invalid evidence |
| OD-13 | Approval/execution binding | OPEN | Approve constraints proving one approval consumes exactly once | D7-G3 | Double-execution / replay hazards |
| OD-14 | Foreign keys and referential integrity | OPEN | Approve FK negatives + referential proofs on target | D7-G4 | Broken referential integrity unseen |
| OD-15 | Trusted time | OPEN | Approve trusted time source for the run | D7-G9/foundational | Timestamp evidence challengeable |
| OD-16 | Running-task takeover and fencing | OPEN | Approve takeover/fencing semantics | D7-G3/recovery | Concurrent workers corrupt evidence |
| OD-17 | Replay semantics | OPEN | Approve replay rules (idempotency) | D7-G3/G4 | Non-deterministic results |
| OD-18 | Outbox recovery | OPEN | Approve outbox recovery behavior | D7-G2/G3 | Lost/undelivered side effects |
| OD-19 | Durable approval-v2 runtime requirement | OPEN | Approve durable-authority wiring: no fallback, restart/second-process proof, fail-closed consume | D7-G1 | In-memory fallback undermines durable approvals |
| OD-20 | Requester/approver separation and trusted actor | OPEN | Approve actor derivation + self-approval refusal | D7-G2/G3 | Self-approval fraud vector |
| OD-21 | Multi-workspace isolation | OPEN | Approve WA/WB RLS matrix + cross-tenant denial proofs | D7-G4 | Cross-tenant access |
| OD-22 | Authenticated route, rate limit, and kill switch | OPEN | Decide whether the task route stays off, or full controls approved | D7-G8 | Unauthenticated route exposure |
| OD-23 | Change control, baseline freeze, and promotion | OPEN | Sign frozen hashes, diff/change-log, no-promotion rule | D7-G9 |
| — | (release condition) | — | — | D7-G9 | Provenance of any later execution unprovable |

Remaining checkpoints: **D7 baseline NOT ESTABLISHED · D7 gate score 0/10 — NO-GO · 10 gates D7-G0…G9 OPEN — NOT MET · 23/23 decisions OPEN. Corollary gate statuses preserved: Phase 5 BLOCKED; release NO-GO (also independently supported by this repo's 8 unmerged commits + unpatched critical vulnerabilities).**

## 2. External/material blockers (beyond D7)

| Blocker | Needed for | Owner/dependency |
| --- | --- | --- |
| Google Calendar **first consent visit** (staging) + callback URI re-registration if host changed | Calendar feature completion | Human owner/admin (`STAGING_OAUTH_CONSENT_RUNBOOK.md` §"Owner action-slip") |
| Google token-key escrow/rotation drill | Production-grade calendar | Owner + security reviewer |
| Meta WABA registration + controlled known-number outbound test approval | Real outbound messaging | Human owner (partnership/business verification) |
| Paid OpenAI key (and `OPENAI_API_KEY`/`OPENAI_MODEL` configuration) | `AI_PROVIDER=openai` actually functioning | Owner (billing) |
| Staging/production credentials & deployment tokens (revocation/rotation policy) | Live environment verification, integration suites | Owner infra |
| Disposable local Supabase stack authorization (ties to OD-02) | `verify:supabase:local`, integration tests | Owner |
| Migration #26 (`calendar_oauth_connections`) production application, whenever calendar goes live | Calendar production | Owner (after #218/#219 merge) |
Two `GO/NO-GO drivers` from origin/main not on this branch (#215 staging appointment adapter, #219/#222 migration replay + outbound finalizer) must be reconciled before release claims. | Merge dispatcher | Owner |

## 3. Decisions deliberately NOT made in Phase A

- No commits, merges, branch updates, or ref deletions (including the 4 stale Temp-worktree registrations and removal of root strays).
- No consent/OAuth/Meta/OpenAI/DB action.
- No remediation commits for the 19 npm-audit findings (upgrade plan is documented in `PHASE_A_SECURITY_AUDIT.md`, class: owner-approved maintenance).
- The recovered D7 conflict-correction proposal remains **PROPOSED — NOT APPLIED**; applying it would require the same owner signature regime it serves.

## 4. Release readiness verdict (evidence-based, this branch)

**NO-GO.** Independent repo-local reasons: 8 unmerged origin/main commits incl. dependency patch `5aaff15` (fast-uri) and critical-fix-adjacent work; `npm audit` 2 critical + 5 high unresolved; fresh-build verification environment-sensitive (OneDrive placeholders — remediated but recurring risk); WhatsApp outbound disabled by design. The D7 cluster and Phase 5 acceptance remain missing prerequisites.
