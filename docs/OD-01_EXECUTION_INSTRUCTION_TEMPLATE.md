# OD-01 — SEPARATE EXECUTION INSTRUCTION (TEMPLATE FOR OWNER COMPLETION)

> ## TEMPLATE — NOT AN INSTRUCTION — NOT AUTHORIZATION
> This template becomes a valid, owner-issued execution instruction **only after** the repository owner completes every scope field and signs **Section K** below. Blank or partially completed, it authorizes nothing. A chat message, a verbal statement, or any agent-prepared text does **not** count as this instruction — the completed, signed file itself is the record.
>
> It must be **consistent with the signed OD-01 authorization document** (`OD-01_OWNER_AUTHORIZATION_SIGNED…`). If this instruction and the signed OD-01 ever conflict on any scope item, the operator **STOPS** and reports the conflict. This template does not authorize Stage F on its own — it requires BOTH the signed OD-01 AND this signed instruction, both verified fresh against live Git/deps state.

**Template prepared:** 2026-11-07 (operator; all decision fields intentionally blank)
**Companion document:** `docs/OD-01_OWNER_AUTHORIZATION_DRAFT.md` (owner to complete & sign separately)

---

## A. Instruction identity (owner completes — all blank)

| Field | Owner entry |
|---|---|
| Full legal name (as on OD-01 signature) | ______________________________ |
| Role / authority | ______________________________ |
| Instruction issue date & time | ______________________________ |
| Timezone | ______________________________ |
| Internal reference / ticket (optional) | ______________________________ |

## B. Approved repository & branches (facts prefilled from reports; owner must confirm or correct)

| Item | Value | Owner confirm/correct |
|---|---|---|
| Repository (local) | `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` | `[ ]` Correct |
| Repository (remote) | `https://github.com/ys7259218-maker/nexa.git` | `[ ]` Correct |
| Current work branch (preserved work source) | `codex/appointment-integration-v1` @ `8c70be6` | `[ ]` Correct |
| Merge source branch | `origin/main` @ `3c10dca` | `[ ]` Correct |
| Integration branch name (proposed `codex/merge-harden-integration`; owner may rename) | ______________________________ | `[ ]` Approved as written |
| **Destination branch (candidate/PR target) — owner MUST name it** | ______________________________ | `[ ]` Named knowingly |

## C. Commit decisions (per-commit checkboxes; blank = not approved)

| Commit | Reported purpose (MH-B) | Decision |
|---|---|---|
| `80cc24c` | staging calendar alias rejection guard (PR #218) | `[ ]` Approve `[ ]` Reject `[ ]` Refer to OD-01 — initials ________ |
| `18b6acf` | docs: staging OAuth & migration status (PR #217) | `[ ]` Approve `[ ]` Reject `[ ]` Refer to OD-01 — initials ________ |
| `4f2967a` | migration source file + CI harness, NO execution (PR #219) | `[ ]` Approve `[ ]` Reject `[ ]` Refer to OD-01 — initials ________ |
| `5aaff15` | fast-uri lockfile patch (PR #220) | `[ ]` Approve `[ ]` Reject `[ ]` Refer to OD-01 — initials ________ |
| `141a81a` | staging overlay replay test, disposable CI DB (PR #221) | `[ ]` Approve `[ ]` Reject `[ ]` Refer to OD-01 — initials ________ |
| `4210993` | outbound finalizer success-path test, disposable CI DB (PR #222) | `[ ]` Approve `[ ]` Reject `[ ]` Refer to OD-01 — initials ________ |
| `3c10dca` | recovery bundle rejection test (PR #223) | `[ ]` Approve `[ ]` Reject `[ ]` Refer to OD-01 — initials ________ |
| `c2b2120` | staging booking integration (PR #215) — **OWNER REVIEW REQUIRED** | `[ ]` Approve with reviewed conflict resolution `[ ]` Reject `[ ]` Defer — initials ________ |

Rule: a checked row authorizes **that commit as characterized** into the integration workspace only — not push, not PR, not production anything.

## D. Preservation & workspace operations (each blank by default)

| # | Operation | Decision |
|---|---|---|
| D1 | Verified one-time preservation copy of working tree (destination: owner-named ______________________) | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| D2 | SHA-256 preservation manifest record (hashes only) | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| D3 | Create integration branch (name per §B) — no force, no existing-branch edits | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| D4 | Preserve ALL modified + untracked files; deletion prohibited | `[ ]` ACKNOWLEDGED — initials ________ |
| D5 | Root stray files (`page.tsx`, `route.ts`) — default LEAVE UNTOUCHED | `[ ]` Leave untouched `[ ]` Authorize deletion post-integration — initials ________ |
| D6 | `git worktree prune` of 5 stale registrations | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |

## E. Merge & conflict policy

| Item | Decision |
|---|---|
| Merge `origin/main` @ `3c10dca` into the §B integration branch | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| Commit preserved working tree onto integration branch | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| Conflict resolution: intent-preserving, documented per conflict; blind ours/theirs prohibited; WhatsApp/migrations-exec/auth/RLS/booking-ledger/calendar-gate/deploy-config files escalate to owner | `[ ]` ACKNOWLEDGED — initials ________ |
| Final local verification (full matrix + fresh build) required before any further step | `[ ]` ACKNOWLEDGED — initials ________ |

## F. Dependency remediation scope (proposals from MH-E; each needs fresh re-verification at execution; blank = not approved)

| Package | Proposed target (PROPOSAL) | Decision |
|---|---|---|
| next | ≥16.4.1 (no major jump) | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| @sentry/nextjs | 10.78.0 (pin bump) | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| sharp | ≥0.35.5 | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| source-map-js | ≥1.2.2 | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| brace-expansion | ≥1.1.21 / ≥5.0.12 (chains) | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| fast-uri | ≥3.1.9 | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| zod (dev-chain only) | ≥4.6.6 | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |
| Lockfile changes (restricted to the approved rows) | — | `[ ]` APPROVED `[ ]` NOT APPROVED — initials ________ |

**Non-waivable constraints (operator will not accept any contrary instruction):** no `npm audit fix` / `--force`; no unreviewed major upgrades; no guessed floors; no unrelated upgrades; before/after `npm audit --json` evidence mandatory; no production deployment.

## G. Publication controls (merge approval NEVER includes these; blank = not approved)

| Operation | Decision + scope |
|---|---|
| Push to remote | `[ ]` NOT APPROVED `[ ]` APPROVED — remote: ______________ branch: ______________ — initials ________ |
| Create PR | `[ ]` NOT APPROVED `[ ]` APPROVED — source: ______________ target: ______________ title: ______________ contents: ______________ — initials ________ |
| Modify existing PR | `[ ]` NOT APPROVED `[ ]` APPROVED — scope: ______________ — initials ________ |
| Close PR | `[ ]` NOT APPROVED `[ ]` APPROVED — scope: ______________ — initials ________ |
| Force-push | **Prohibited unconditionally — cannot be approved in this template.** |

## H. Verification authorization

Full local matrix (`typecheck`, `lint`, `test` 667, issue-reports, guards, tracked-secrets, production-build check, `git fsck --full`, `npm audit --json`, fresh local build): `[ ]` AUTHORIZED `[ ]` NOT AUTHORIZED — initials ________
Disposable-DB integration tests (OD-02-equivalent): `[ ]` NOT AUTHORIZED (default) `[ ]` AUTHORIZED — instance/config: ______________ — initials ________

## I. Exclusions (standing, unchanged; operator will refuse contrary verbal instructions)

Production deployment · migrations against production · live OAuth · WhatsApp outbound activation (`WHATSAPP_OUTBOUND_ENABLED` stays `false`) · real customer messages · production credentials/env/data changes · customer-facing workflow enablement · destructive cleanup · Git history rewrite/force-push · weakening auth/RLS/guards · Migrations are never executed on any real database during Stage F (files only, tests run on disposables if §H approves).

## J. Stop conditions, validity, revocation

| Item | Owner entry |
|---|---|
| Immediate stop: verification failure, scope ambiguity, conflict with signed OD-01, unexpected repo state, expiry | `[ ]` ACKNOWLEDGED — initials ________ |
| Expiry date (blank = no approval has duration) | ______ / ______ / __________ |
| Renewal conditions: any HEAD/`origin/main` change since signing; any failed gate; scope additions | `[ ]` ACKNOWLEDGED — initials ________ |
| Revocation right: owner revokes in writing anytime, effective immediately | `[ ]` ACKNOWLEDGED — initials ________ |

## K. Owner signature & operator acknowledgment (blank; humans only)

**Owner / authorized decision-maker**
- Full legal name: ______________________________
- Role / authority: ______________________________
- Signature: ______________________________
- Date & time: ______________________________  Timezone: ______________________________

**Technical execution acknowledgment (human accountable operator)**
- Name / role: ______________________________
- Signature: ______________________________
- Date & time: ______________________________

---

## Mandatory statements

1. **This file, unsigned or incomplete, grants no permission. The operator executes nothing on chat statements, verbal approval, intent expressions, or any agent-prepared text.**
2. This instruction works **only together with** the signed OD-01 authorization; the pair must cover: repository, source/destination branches, approved commits, preservation, branch creation, commits, merge, (only if approved) push/PR, dependency scope, exclusions, stop conditions.
3. Phase B implementation is a **separate track** — this instruction does not authorize it; OD-B1…OD-B12 decisions + a further explicit instruction would be needed (see `docs/DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md`).
4. **Operator blank-field audit at intake:** any blank scope field above ⇒ instruction incomplete ⇒ STOP before execution.

**Status: `TEMPLATE PREPARED — AWAITING OWNER COMPLETION & SIGNATURE — STAGE F BLOCKED`**
