# DEXYBOR AI — MERGE & HARDEN: INTEGRATION PLAN (PROPOSED — NOT EXECUTED)

**Report ID:** MH-D · **Stage:** D (Integration strategy design) · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa`
**Refs:** HEAD `8c70be6` (`codex/appointment-integration-v1`) · origin/main `3c10dca` · local main `06679d9` (0 unique)
**Status:** planning artifact only. Every Git mutation it describes is **NOT APPROVED** (see `MERGE_HARDEN_AUTHORIZATION_REVIEW.md`). === PROPOSED ONLY, NOTHING EXECUTED ===

---

## 1. Topology-driven strategy choice (not count-driven)

Facts used: local `main` has **zero** unique commits (18 commit gap is one-sided); the feature branch carries the canonical feature work (149 commits, +5508/−5 vs base) plus uncommitted refinements (+248/−44); `origin/main` carries 8 commits that the branch does **not** contain at patch level (cherry empty; fresh `npm ls` shows fast-uri 3.1.6 while #220 patches only origin/main's lockfile; #218's alias-rejection logic is absent from HEAD's gate file).

| Strategy | Assessment | Decision |
|---|---|---|
| S1 — Integration branch from `8c70be6` + `git merge origin/main`, then PR | Preserves both lineages, zero history rewrite, conflicts resolved once, full verification before anything reaches `main` | **PROPOSED** |
| S2 — Rebase feature branch onto `origin/main` | Rewrites a published branch (pushed to origin) = shared-history rewrite; forbidden unless separately authorized; also replays 149 commits (high risk) | EXCLUDED |
| S3 — Merge feature branch into local `main`, then PR | Adds no value: `main` has 0 unique commits; equivalent endpoint to S1 with extra motion | EXCLUDED |
| S4 — Cherry-pick only #220/#218 (minimal security intake) | Leaves 6 other commits unresolved (docs-truth, migration harnesses, recovery-bundle guard), re-plays future divergence; only if owner demands a minimal surgical action | OWNER DEFERRED |

## 2. Per-commit disposition (summary — full analysis in MH-B §3)

| Incoming commit | Disposition |
|---|---|
| `c2b2120` (#215) appointment-booking staging integration | OWNER REVIEW REQUIRED — include content; calendar/booking overlap resolved by intent review |
| `80cc24c` (#218) primary-alias rejection | INCLUDE |
| `18b6acf` (#217) staging OAuth / migration status truth docs | INCLUDE |
| `4f2967a` (#219) migration replay CI + outbound-finalizer repair SQL | INCLUDE (files only; execution of migrations stays blocked) |
| `5aaff15` (#220) fast-uri 3.1.8 lockfile patch | INCLUDE + superseded upgrade at merge time (final state ≥3.1.9, requires dep authorization) |
| `141a81a` (#221) staging overlay replay harness | INCLUDE |
| `4210993` (#222) outbound finalizer disposable-DB proof | INCLUDE |
| `3c10dca` (#223) recovery-bundle contents guard | INCLUDE |

**Totals:** INCLUDE 7 · OWNER REVIEW REQUIRED 1 · EXCLUDE 0 · ALREADY-PATCH-INTEGRATED 0. Semantic overlap pointer: #218's *store-level protection* has an existing branch-side contract test ("calendar id is never defaulted and never falls back to a primary calendar"), but the #218 gate/configure logic itself is not on the branch — no exclusion on that basis.

## 3. Proposed execution sequence (requires authorization for every step)

1. **Pre-flight:** verify preservation copy-out by hash (MH-C §6 manifest); verify HEAD still `8c70be6`, `origin/main` still `3c10dca`; verify clean staging area; verify OneDrive client running.
2. **Workspace:** create integration branch `codex/merge-harden-integration` from `8c70be6` (new worktree under an owner-approved location; do **not** move/delete existing worktrees).
3. **Capture user work:** commit the preserved working tree onto the integration branch with an owner-approved, explicitly-listed file set (12 modified + calendar/docs untracked files). Root duplicates excluded from that commit unless owner says otherwise (they stay untracked/preserved).
4. **Ingest:** `git merge origin/main` into the integration branch. Resolve conflicts individually per §4; document each with both intents; never `-X ours/theirs` blind resolution.
5. **Dependency finalization (only with dep authorization):** align lockfile; enforce `fast-uri >= 3.1.9`; no `npm audit fix`; inspect full lockfile diff.
6. **Verification:** run the full fresh matrix (typecheck, lint, `npm test`, guards, issue reports, `npm run audit --json` re-count, fresh production build; WhatsApp + calendar suites re-run).
7. **Publication:** PR-based only; push only if push authorization exists; `main` receives nothing by direct push.

Stop conditions: any verification failure, any conflict in WhatsApp/auth/RLS/migration/deploy-config files that is not unambiguous, or preservation mismatch ⇒ halt and return to owner.

## 4. Conflict forecast & resolution policy

| Area | Why conflicts are likely | Resolution policy |
|---|---|---|
| `lib/calendar/googleCalendarGate.ts` | Two lineages: branch/working-tree version adds `isSaneSupabaseUrl` + `GOOGLE_CALENDAR_PRODUCTION_ENABLED` opt-in (uncommitted), incoming adds #218 alias rejection in the same file (file may not trace-merge cleanly) | **Manual, intent-preserving merge:** keep both the staging guard semantics *and* the alias rejection; owner reviews final gate semantics |
| `app/api/integrations/google-calendar/configure/route.ts` (+ possibly callback/connect status variants) | Working tree edits (+4/−4, +6/−5 …) overlap c2b2120/#218 content on the same routes | Manual per-file review; staging guard intact; **customer-safety and OAuth guards never relaxed** |
| `lib/server/googleCalendarStore.ts` + store contract test | #218 modifies both; branch has its own contract assertion | Merge both assertions; run calendar suites |
| `docs/GO_LIVE.md`, `NEXA_HANDOFF.md` | Locally modified (uncommitted) and touched by #3/#4/#215 | Truth-consolidation: incoming status docs + local additions; `operationalDocsTruth` test must pass |
| `package-lock.json` | #220 patch vs branch lineage; plus step-5 dependency finalization | Regenerate deterministically after owner-approved package.json edits; verify diff shows only authorized packages |
| `package.json` (scripts) | #221 adds a script line | Auto-merge; verify script table |
| `.github/workflows/ci.yml` | #215/#219/#221/#223 all edit CI | Accept incoming CI additions; no deploy/migration auto-runs added |
| Appointment/booking SQL + harnesses | #219 adds a new migration file; harnesses may reference file sets | Content-additive; no migration execution; individual review if overlapping |

**Owner review required at conflict time:** anything touching WhatsApp runtime, auth/RLS, migrations exec paths, production deployment config, booking-ledger semantics, calendar OAuth guards — per master prompt §8.

## 5. What this plan deliberately does NOT do

- Does not flip `WHATSAPP_OUTBOUND_ENABLED` or touch Meta configuration.
- Does not enable live Google Calendar OAuth (guards + staging/project + consent remain owner-gated).
- Does not execute any migration; it only integrates *files*.
- Does not touch `origin/main`; no force operations; stale worktree pruning and stray-file deletion remain owner decisions.
- Does not implement any DEXYBOR Phase B capability.

## 6. Approval checklist unblocking this plan

Stage-F authorization must cover: (a) preservation copy, (b) integration branch/worktree creation, (c) commit list approval, (d) merge operation + direction, (e) dependency floor `fast-uri>=3.1.9` (or defer), (f) push/PR mode, (g) who reviews the calendar/booking/doc conflicts. Anything less keeps this plan as a document.
