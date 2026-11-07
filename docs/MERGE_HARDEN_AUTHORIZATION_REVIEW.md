# DEXYBOR AI — MERGE & HARDEN: AUTHORIZATION REVIEW

**Report ID:** MH-A · **Stage:** A (Authorization Gate) · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa`
**Evidence HEAD at collection:** `8c70be6` on `codex/appointment-integration-v1` (in sync with `origin/codex/appointment-integration-v1`)
**Nature of this operation:** controlled Git reconciliation & security hardening — **READ-ONLY except report authorship**.

---

## 1. Result of the gate

**Authorization for any mutating operation: ABSENT.**

`MERGE & HARDEN — AUTHORIZATION BLOCKED` for commits, merges, pushes, branch/worktree changes, dependency changes, migrations, deployments and provider/config changes. Investigation, reporting and safe local verification continued as explicitly directed by the master prompt (§1 "Default operating mode: READ-ONLY", §3 "You may continue independent read-only investigation and safe isolated tests").

A decision being *directed by a prompt* is not *owner authorization*. No instruction in this session constitutes a signed owner record, and none of the 23 D7 decisions has a documented OWNER approval carrying a name, date, scope and stop conditions.

## 2. Evidence inventory (fresh, 2026-11-07)

| # | Source | What it shows |
|---|---|---|
| E1 | Master prompt (this session) | Defines required stages, safety policy, classification duty. It is a directive, not an approval. |
| E2 | `docs/PHASE_A_OWNER_BLOCKERS.md` (recovered D7) | OD-01 **OPEN**: "Accountable owner and authorization authority … Name accountable owner, independent reviewers, conflict-of-interest attestation, stop authority." D7: 0/10 decisions approved; release NO-GO. |
| E3 | Fresh repo search for OD-01 evidence (2026-11-07, `docs/**`): 4 hits | All four are the Phase A quote above and its restatement in `PHASE_A_FINAL_REPORT.md` ("a fresh signed OD-01 record is still the single root authorization"). **No new approval artifact exists in the repository.** |
| E4 | Prior intake (recorded in Phase A docs) | `OWNER_EVIDENCE_MISSING` (2026-10-23). D7 documents are verbatim-recovered out-of-repo copies, not owner-signed records. |
| E5 | Live Git state | 12 modified tracked files + 14 untracked files (user work in flight) — see `MERGE_HARDEN_WORK_PRESERVATION.md`. No staging, no stash, no in-progress merge. |
| E6 | `C:\Users\ys725\AppData\Local\Temp\opencode\recover\` (Phase A) | D7 decision tables preserved verbatim; all decisions OPEN; proposals marked PROPOSED — NOT APPLIED. |

## 3. Accountable owner

**UNKNOWN / UNRESOLVED — controlled by OD-01.** No individual is documented as accountable owner, no independent reviewer is named, and no conflict-of-interest attestation exists. Until OD-01 is signed, *every* mutating stage below is blocked at the root (this mirrors D7-G0).

## 4. Action classification

Legend: **AP** = APPROVED · **NA** = NOT APPROVED · **NAp** = NOT APPLICABLE · **UC** = UNCLEAR — OWNER CONFIRMATION REQUIRED. "Scope" = authority relied upon.

| # | Operation | Class | Scope / justification |
|---|---|---|---|
| A1 | Read-only Git inspection (`rev-parse`, `status`, `log`, `cherry`, `show`, `diff`, `fsck`, `worktree list`, `ls-files`) | AP | Master prompt §1/§4 (explicit command list). |
| A2 | Read-only npm/npx inspection (`npm audit --json`, `npm ls`, version reads) | AP | Master prompt §7 (explicit command list). |
| A3 | Creation of the 9 `docs/MERGE_HARDEN_*.md` reports | AP | Master prompt §13 (required deliverables). New files only; no overwrite. |
| A4 | Safe local unit tests (`npm test`, `test:issue-reports`, WhatsApp subset, guards) | AP | Master prompt §1 ("safe isolated tests"), §9 ("safe local tests"). Node-local only; no external side effects. |
| A5 | Fresh local production build (`npm run build`, artifact `.next/`) | AP | Master prompt §10 build evidence duty. Local-only, no deploy, no config change. |
| A6 | Commit (incl. commit of the 12 modified files / calendar work) | **NA** | No authorization covering Git write operations exists. |
| A7 | Merge (any direction, incl. the proposed integration merge of `origin/main`) | **NA** | Stage F permitted "only when the exact operation has been explicitly authorized". |
| A8 | Push (any branch, esp. `main`) | **NA** | No push permission recorded. |
| A9 | Creation of integration branch / integration worktree | **NA** | Branch/worktree creation is a Git mutation; Stage F requires authorization first. |
| A10 | `worktree prune` of 5 stale "prunable" registrations (Temp paths) | **UC** | Registrations reference branches that are intact; cleanup is safe-looking but is a Git metadata mutation. Owner to approve. |
| A11 | Deleting root strays `page.tsx` / `route.ts` | **UC** | Inert duplicates (evidence in Work Preservation report); deletion is owner's call after review. |
| A12 | Dependency changes (lockfile/package.json edits for next/@sentry/nextjs/zod/sharp/fast-uri/source-map-js/brace-expansion) | **NA** | §7 requires explicit authorization; only a *proposal* was produced. |
| A13 | `npm audit fix` or `npm audit fix --force` | **NA (forbidden)** | §7 explicitly forbids `--force`; `audit fix` was not run at all. |
| A14 | Database migrations (`supabase` migrations, scripts, verification against DBs) | **NAp + NA** | No migration was executed, planned for execution, or authorized. Migration files on `origin/main` (#219) are referenced in the integration plan only. |
| A15 | Deploy to staging / production (Vercel or other) | **NA**| §1/§8. |
| A16 | Enabling `WHATSAPP_OUTBOUND_ENABLED=true` / sending any customer message | **NA (forbidden)** | §1. Value remains `false` everywhere; confirmed fresh. |
| A17 | Changing Meta webhook configuration or making any external WhatsApp call | **NA** | §1/§9. |
| A18 | Live Google Calendar OAuth connection / credential changes | **NA** | §1. Staging/production consent is owner-gated. |
| A19 | `git reset --hard`, `git clean -fd`, `force-push`, history rewrite, ref deletion | **NA (absolutely forbidden)** | §1. None attempted. |
| A20 | Weakening auth/authz/RLS/guards to make checks pass | **NA (forbidden)** | §1. No source files were touched. |
| A21 | Production-release approval (`PRODUCTION_RELEASE_APPROVED`) | **NAp** | Value not set on this machine; owner-only decision. Release stays NO-GO. |

**OD-01 (if signed) is NOT blanket permission:** a signed OD-01 names the authority holder; it does not by itself authorize A6–A19. Each of those still needs its own scope (what, where, when, by whom, with which stop conditions), per master prompt §3.

## 5. State at this boundary

- Git: zero mutations. `git status` byte-comparable before and after verification; HEAD/branch unchanged; no new commits, no merges, no pushes, no ref updates; `git fsck --full` exit 0.
- Deps: `package.json` / `package-lock.json` untouched (read-only `npm audit --json` only).
- Runtime/config: no env values created or changed; `.next/` rebuilt locally from an already-authorized verified baseline (phase A precedent) with OneDrive client running.
- WhatsApp/Calendar: no external calls; outbound still disabled.
- This session's only repo writes: the 9 new `docs/MERGE_HARDEN_*.md` files.

## 6. What authorization must contain to unblock Stage F

1. Signed OD-01 owner record (name, date, scope, stop authority).
2. Explicitly enumerated operations: (a) preservation copy-out, (b) commit of existing working-tree work, (c) creation of integration branch/worktree, (d) merge direction and source/destination, (e) conflict-resolution review duty for calendar/WhatsApp/migration files, (f) push permission or PR-only flow, (g) dependency-upgrade authority per package, (h) any DB/disposable-DB usage (OD-02), (i) who signs off release GO/NO-GO.
3. Expiry and revocation method, and a rule that approval of one operation does not extend to others.

## 7. Compliance record

Commands NOT run, verbatim from the forbidden list: `git reset --hard`, `git clean -fd`, `git push --force*`, rebase/history rewrites, `npm audit fix --force`, any deploy or migration runner. `git worktree prune`, `git branch -D`, stash drop, and any destructive cleanup were **not** attempted.

— End of Stage A report. This gate is closed for mutations. Next stage input: Stage B divergence analysis (delivered as its own report).
