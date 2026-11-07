# OD-01 OWNER AUTHORIZATION — DRAFT FOR SIGNATURE

> ## DRAFT — NOT SIGNED — NOT AUTHORIZATION
> This document is a **preparation artifact only**. It grants nothing until the accountable owner signs Section K after reviewing every section. Until signed by the owner and countersigned by the technical execution operator, it is a proposal with blank decision fields.

**Draft prepared:** 2026-11-07 (from the 9 `docs/MERGE_HARDEN_*.md` reports; sources cited per section)
**Prepared by:** OpenCode agent session (technical execution operator — NOT an owner and NOT an approver)
**Repository:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` (remote: `https://github.com/ys7259218-maker/nexa.git`)
**Governing status at preparation time:** `MERGE & HARDEN — AUTHORIZATION BLOCKED` (`MERGE_HARDEN_FINAL_REPORT.md`)

---

## A. Project and owner identification

| Field | Value |
|---|---|
| Repository owner / authorized decision-maker: | ______________________________________________ |
| Organization or legal entity: | ______________________________________________ |
| Repository: | nexa (DEXYBOR AI legacy name) — pre-filled from reports; owner to confirm/correct |
| Current branch: | `codex/appointment-integration-v1` — pre-filled from reports (`MERGE_HARDEN_GIT_DIVERGENCE.md` §1); owner to confirm/correct |
| Current HEAD: | `8c70be6eeb8d5dbabbbdcff515b8d55f67e69961` — pre-filled from reports; owner to confirm/correct |
| Date: | ______ / ______ / __________ (preparation date reference: 2026-11-07) |
| Timezone: | ______________________________________________ |
| Authorization reference (your internal ID, ticket, or minute ref): | ______________________________________________ |
| Owner's authority to approve repository changes (basis: e.g., repository admin, company officer): | ______________________________________________ |

**No owner identity is assumed or filled.** The signing owner must be an actual person with repository authority. Filling this section is part of Section K signing.

## B. Current project status (as reported — sources in parentheses)

Completed (evidence-backed):
1. **Investigation complete**: full Git divergence analysis, preservation inventory, integration plan, security proposal, WhatsApp regression review, verification suite, architecture review — 9 reports delivered. (`MH-A…MH-J`)
2. **Existing user work preserved**: 12 modified tracked files (+248/−44) + 14 untracked files unchanged all session; SHA-256 manifest recorded; `git status` pre/post identical. (`MERGE_HARDEN_WORK_PRESERVATION.md` §1–§3)
3. **Verification suite passed locally** (2026-11-07): typecheck exit 0; lint 0 errors/16 non-blocking warnings; `npm test` 667/667 PASS; issue-reports 5/5; guards 3/3 PASS; `git fsck --full` exit 0. (`MERGE_HARDEN_VERIFICATION.md` §2)
4. **Fresh local production build PASS**: BUILD_ID `YlYbA_DahfD0FyTlwunD_`, 40/40 routes. (`MERGE_HARDEN_VERIFICATION.md` §3)

Not done (still pending owner authorization):
1. **No Git integration mutations performed** — no commits, merges, pushes, branch/worktree changes, or ref updates in this session. (`MERGE_HARDEN_FINAL_REPORT.md` "Git history")
2. **Security remediation NOT performed** — fresh audit still reports **19 findings (2 critical, 5 high, 12 moderate)**; proposals only. (`MERGE_HARDEN_SECURITY_REMEDIATION.md` §1, §6)
3. **Production release remains NO-GO.** (`MERGE_HARDEN_FINAL_REPORT.md`)
4. **Stage F execution remains BLOCKED** pending the explicit approvals in this document. (`MERGE_HARDEN_AUTHORIZATION_REVIEW.md` §4)

Proposed-not-completed ledger (each requires its own approval below):
preservation copy · integration branch · commits · merge · conflict resolution · dependency remediation · push/PR · optional worktree prune of 5 stale registrations. Nothing in `MERGE_HARDEN_INTEGRATION_PLAN.md` is executed; everything there is classified **NOT APPROVED** by `MERGE_HARDEN_AUTHORIZATION_REVIEW.md`.

Reported Git baseline facts used throughout this document (owner should re-confirm at signing):

| Ref | Reported value |
|---|---|
| Current branch | `codex/appointment-integration-v1` (in sync with its origin counterpart) |
| Current HEAD | `8c70be6…` (full SHA above) |
| `origin/main` | `3c10dca…` |
| local `main` | `06679d9…` (0 unique commits; behind 18) |
| Divergence | 8 commits only on `origin/main`; 149 only on the feature branch; patch-equivalent overlap: none |

## C. Preservation authorization (separate approvals; independent of Section D–F)

Default rule: **overwrite is prohibited for every item below unless this text is struck through/edited by the signing owner.** Destination paths outside the repo must be recorded by the operator and kept private (no credentials).

| # | Exact permitted operation | Source | Destination | Overwrite | Approval | Owner initials |
|---|---|---|---|---|---|---|
| C1 | Create a verified one-time copy of the repository working tree (excluding `.next`, `node_modules`, `.codex-worktrees`) for rollback safety | Repo working tree at signed HEAD | Owner-named location: ____________________ | PROHIBITED unless owner edits here: ______________ | `[ ]` APPROVE  `[ ]` REJECT  `[ ]` DEFER | ________ |
| C2 | Record a SHA-256 preservation manifest (files-by-hash only; no contents, no secrets) of the 12 modified + 14 untracked files | Repo working tree | Manifest file recorded with Stage F run log | PROHIBITED | `[ ]` APPROVE  `[ ]` REJECT  `[ ]` DEFER | ________ |
| C3 | Create an integration **branch** only (no worktree unless owner initializes C3b) | HEAD `8c70be6` | Proposed name: `codex/merge-harden-integration` (owner may rename: ____________________) | n/a (new branch; never touches existing branches) | `[ ]` APPROVE (branch)  `[ ]` APPROVE (branch + named worktree)  `[ ]` REJECT  `[ ]` DEFER | ________ |
| C4 | Ensure ALL modified and untracked files are preserved: nothing deleted, nothing overwritten, staging (`git add`) commences only after C1+C2 verification | Repo working tree | Unchanged on disk; copies per C1 | PROHIBITED | `[ ]` APPROVE  `[ ]` REJECT  `[ ]` DEFER | ________ |
| C5 | Handle root-level duplicate/near-duplicate files (`page.tsx`, `route.ts` — analyzed as inert strays; route.ts byte-identical to the calendar callback route) | Root files | Option A: leave untouched (default). Option B: authorized deletion after integration (per = ____________________). Deletion from the **untracked set** only; never from any committed lineage. | PROHIBITED by default | `[ ]` LEAVE UNTOUCHED  `[ ]` APPROVE deletion post-integration  `[ ]` DEFER | ________ |

Extra owner decision (this document does NOT authorize it; explicitly not approved by default): `git worktree prune` of the 5 stale "prunable" registrations — `[ ]` APPROVE (prune only these 5 registrations; branches kept) `[ ]` REJECT / DEFER — if approved, name an approver: ______________ initials ________.

## D. Commit-level integration authorization

The reported facts and the operator's **PROPOSED** classification (from `MERGE_HARDEN_GIT_DIVERGENCE.md` §3 / `MERGE_HARDEN_INTEGRATION_PLAN.md` §2) are below. **A proposal is not approval.** The owner makes an individual, explicit decision per commit row. A blank row = no authorization.

| Commit | Reported purpose | Proposed classification (operator) | Owner decision |
|---|---|---|---|
| `80cc24c` | fix: reject primary calendar alias in staging configuration (PR #218) — security guard; gate + configure + store + contract test; **reported absent from current HEAD** (gate/configure/store alias logic is origin/main-only) | INCLUDE | `[ ]` Approve integration `[ ]` Reject integration `[ ]` Defer review — initials ________ Rationale (optional): ________________ |
| `18b6acf` | docs: reconcile staging OAuth and production migration status (PR #217) | INCLUDE | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ Rationale: ________ |
| `4f2967a` | ci/db: replay migrations and repair outbound finalizer (PR #219) — adds migration-source file + CI harness; does not execute migrations | INCLUDE (files only) | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ Rationale: ________ |
| `5aaff15` | fix(deps): update fast-uri to patched 3.1.8 (PR #220) — lockfile-only patch; **reported absent from current HEAD** (local fast-uri 3.1.6); newer advisories make ≥3.1.9 the final required floor (Section G) | INCLUDE | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ Rationale: ________ |
| `141a81a` | test: replay staging appointment overlay on disposable CI database (PR #221) | INCLUDE | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ Rationale: ________ |
| `4210993` | test: prove outbound finalizer success path in disposable CI database (PR #222) | INCLUDE | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ Rationale: ________ |
| `3c10dca` | test: reject unlisted recovery bundle contents (PR #223) | INCLUDE | `[ ]` Approve `[ ]` Reject `[ ]` Defer — initials ________ Rationale: ________ |

**Separate line — OWNER REVIEW REQUIRED (do not batch with the table above):**

| Commit | Reported purpose | Proposed classification | Owner decision |
|---|---|---|---|
| `c2b2120` | appointment-booking staging integration: calendar provider, sandbox E2E, server-only adapter, live staging reconcile (PR #215) — high conflict risk against the branch's own calendar/booking implementation | OWNER REVIEW REQUIRED | `[ ]` Approve integration with reviewed conflict resolution `[ ]` Reject `[ ]` Defer — initials ________ Rationale: ________ |

Rules for this section: an approval here authorizes *this commit as characterized* to enter the integration workspace only; it does not authorize push (Section F), dependency floors (Section G), or destination-branch publication. Deferral blocks only that commit, not the others.

## E. Merge authorization (independent approvals; each row blank by default)

| # | Approval item | Details requiring owner input | Status |
|---|---|---|---|
| E1 | Integration workspace creation (branch/worktree per Section C3) | As named in C3 | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ________ |
| E2 | Source for the merge | `origin/main` @ `3c10dca` (merge direction: origin/main → integration branch) | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ________ |
| E3 | Destination branch — **must be explicitly named by owner here** (never `main` unless written explicitly) | ______________________________________ | `[ ]` APPROVE (named destination) `[ ]` REJECT `[ ]` DEFER — initials ________ |
| E4 | Merging the approved commit set (Section D rows approved, incl./excl. `c2b2120` as decided) | Approved commit list = exactly the Section D decisions | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ________ |
| E5 | Conflict resolution authority | Manual, intent-preserving; blind `ours`/`theirs` prohibited; unambiguous-only for WhatsApp, migrations-exec paths, auth/RLS, booking-ledger semantics, calendar OAuth guards, deploy config; documented per conflict | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ________ |
| E6 | Creating the integration commit(s) | Capturing the preserved working tree (owner-approved file list per operator proposal; root duplicates per C5) onto the integration branch | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ________ |
| E7 | Final local verification after merge | Full matrix (Section H) + fresh build must pass; failure ⇒ stop and return to owner | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ________ |

**Approval to merge does NOT include permission to push, create PRs, or publish anywhere.** Publication requires the separate Section F rows.

## F. Commit, push and PR permissions (every default is "Not approved"; each row needs an explicit owner decision + scope)

| Operation | Default | Owner decision | Owner-specified scope (mandatory field) |
|---|---|---|---|
| Create preservation copy | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | Scope: ______________________ |
| Create branch | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | Scope/name: ______________________ |
| Create commit (integration workspace only) | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | Scope (file list & message pattern): ______________________ |
| Merge | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | Scope (per Section E): ______________________ |
| Push to remote | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | If approved — exact remote: ______________ exact branch: ______________ |
| Create PR | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | If approved — source branch: ______________ target branch: ______________ title: ______________ permitted contents: ______________ |
| Modify existing PR | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | Scope: ______________________ |
| Close PR | Not approved | `[ ]` APPROVED `[ ]` STILL NOT APPROVED | Scope: ______________________ |

Force-push is prohibited unconditionally and cannot be approved in this document.

## G. Security remediation authorization (source: `MERGE_HARDEN_SECURITY_REMEDIATION.md`)

Reported findings (2026-11-07 fresh audit): **19 total — 2 critical, 5 high, 12 moderate.**

| Area | Installed (reported) | Proposed target (PROPOSAL ONLY — must be re-verified against fresh advisory data AND the post-merge dependency tree before implementation) | Owner decision |
|---|---|---|---|
| Next.js | 16.3.4 | `>=16.4.1` effective floor (9 advisories fixed by 16.3.8; 2 by 16.4.1) — within-range minor, not a major upgrade | `[ ]` APPROVED `[ ]` REJECT `[ ]` DEFER — initials ________ |
| @sentry/nextjs | 10.74.0 | 10.78.0 (exact pin bump, semver-minor) | `[ ]` APPROVED `[ ]` REJECT `[ ]` DEFER — initials ________ |
| sharp | 0.35.4 | ≥0.35.5 (librsvg CVE-2026-96889) | `[ ]` APPROVED `[ ]` REJECT `[ ]` DEFER — initials ________ |
| source-map-js | 1.2.1 | ≥1.2.2 | `[ ]` APPROVED `[ ]` REJECT `[ ]` DEFER — initials ________ |
| brace-expansion | 1.1.18 & 5.0.9 (two chains) | ≥1.1.21 / ≥5.0.12 for the 2026 DoS advisories | `[ ]` APPROVED `[ ]` REJECT `[ ]` DEFER — initials ________ |
| zod | 4.4.3 | ≥4.6.6 — dev-toolchain chain only in this tree (zero first-party `zod` imports reported); not runtime-reachable | `[ ]` APPROVED `[ ]` REJECT `[ ]` DEFER — initials ________ |
| Other transitive (fast-uri, glob, minimatch, typescript-eslint chain, @sentry plugins) | as reported | fast-uri ≥3.1.9 floor; ride-along bumps for the rest | `[ ]` APPROVED with list: ______________ `[ ]` REJECT `[ ]` DEFER — initials ________ |
| Lockfile changes (`package-lock.json`) | — | Only to server the approved rows above; full diff review required | `[ ]` APPROVED `[ ]` REJECT `[ ]` DEFER — initials ________ |
| Removal of unused dependencies (if justified by fresh `npm ls` evidence) | — | Separate proposal first; not implied by any bump | `[ ]` APPROVED with list: ______________ `[ ]` REJECT `[ ]` DEFER — initials ________ |

**Mandatory constraints (non-waivable within this document):**
- No `npm audit fix` and no `npm audit fix --force`.
- No unreviewed major-version upgrades.
- No guessed version floors — every target re-verified freshly at execution time.
- No unrelated dependency upgrades.
- No dependency change without before/after `npm audit --json` evidence captured and recorded.
- No production deployment as part of this authorization (Section I stands).

## H. Testing and verification authorization (permitted activities)

Permitted read-from-repo checks (no external calls, no DB):
`npm run typecheck` · `npm run lint` · `npm test` · `npm run test:issue-reports` · `npm run check:tracked-secrets` · `npm run check:documented-count` · `npm run check:production-build` · `git fsck --full` · `npm audit --json` (plus `npm ls`) · §fresh production build (`npm run build`, local only).

Additional, separately gated: integration tests using a **disposable local database** (`test:integration*` variants) — only if OD-02-equivalent disposable-DB authorization is separately recorded here: `[ ]` APPROVED for local disposable DB — instance/config: ______________ `[ ]` STILL NOT APPROVED (default) — initials ________.

External integrations (Meta, Google, Vercel, hosted Supabase, OpenAI) remain disabled: no live webhook verification, no OAuth flows, no remote messaging, no hosted-DB connections — unless separately authorized in writing.

## I. Explicitly excluded operations (remain prohibited unless SEPARATE WRITTEN AUTHORIZATION exists; this document cannot grant them by any checkbox)

- Production deployment (Vercel or any host).
- Database migrations against production (any DB the owner designates as production).
- Live OAuth connections (Google Calendar or other).
- Activating WhatsApp outbound messaging (`WHATSAPP_OUTBOUND_ENABLED=true`) or Meta configuration changes.
- Sending real customer messages or making real calls.
- Changing production credentials, secrets, or connected infrastructure.
- Production data modifications.
- Enabling external customer-facing workflows.
- Changing production environment variables.
- Destructive cleanup (`git reset --hard`, `git clean -fd`, stash drop, branch deletion, `worktree prune` unless Section C's separate field explicitly approves it, force-push, any history rewrite).
- Weakening authentication, authorization, RLS, approval gates, or execution safeguards.

## J. Authorization validity and revocation

| Item | Owner entry |
|---|---|
| Approval date | ______ / ______ / __________ |
| Expiry date (blank = no approval) | ______ / ______ / __________ |
| Approved repository & branch scope | repo: nexa (`ys7259218-maker/nexa`) branches: ______________________________ |
| Approved commit list | exactly the Section D approved rows: ______________________________ |
| Approved dependency scope | exactly the Section G approved rows: ______________________________ |
| Conditions requiring renewed approval | any HEAD/`origin/main` change since signing; any failed verification gate; any unresolved conflict touching WhatsApp/auth/RLS/migrations/deploy config; expiry date passing; any scope addition (e.g., new PR target, new package) |
| Owner revocation right | Owner may revoke at any time, in writing, with immediate effect; no compensating action may be taken after revocation notice |
| Excess-scope stop rule | If execution exceeds (or is at risk of exceeding) the approved scope, the operator must STOP IMMEDIATELY and report; no "surplus" execution |

## K. Owner declaration and signatures (blank; to be completed manually by humans)

**Repository owner / authorized decision-maker**

- Full legal name: ______________________________
- Role / authority: ______________________________
- Signature: ______________________________
- Date and time: ______________________________
- Timezone: ______________________________

**Technical execution acknowledgment**

- Responsible operator (human accountable for executing the signed scope): ______________________________
- Signature: ______________________________
- Date and time: ______________________________

---

## Mandatory statement

**An unsigned or incomplete authorization document does not grant permission to perform any Git mutation, dependency modification, external integration, or production operation.**

## Verification checklist of this draft (by operator, at preparation)

1. All approval fields blank / not approved — YES (no checkbox pre-ticked; the single pre-marked NOT-APPROVED field in Section C is a default, not an approval).
2. No operation approved by default — YES.
3. Commit-level decisions individually selectable — YES (Section D).
4. Push and PR permissions independent of merge permission — YES (Section F rows separate from Section E).
5. Dependency remediation separately authorized — YES (Section G).
6. Production operations excluded — YES (Section I).
7. OD-01 not treated as blanket authority — YES (per-section approval structure; authority fields blank in A).
8. No fabricated owner identity/signature — YES (all identity/signature fields blank).
9. Material facts match the 9 reports — YES (values cited per section from MH-A…MH-J; every version number carries its reported date and re-verification requirement).

**Status line:** `OD-01 DRAFT PREPARED — AWAITING OWNER SIGNATURE — STAGE F BLOCKED`
