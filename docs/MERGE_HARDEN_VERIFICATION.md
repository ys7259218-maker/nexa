# DEXYBOR AI — MERGE & HARDEN: FULL APPLICATION VERIFICATION

**Report ID:** MH-H · **Stage:** H (Verification — fresh runs, 2026-11-07) · local machine only, no deployments
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` · HEAD `8c70be6` (unchanged throughout)
**Toolchain:** node v24.18.0 · npm 11.16.0 · OneDrive client verified running (PID 14092) before/build-time

---

## 1. Script selection (per §10: inspect, then run only what exists)

`package.json` scripts inspected (2026-11-07): `typecheck`, `lint`, `test` (list of 667-target test files), `check:tracked-secrets`, `check:production-build`, `check:documented-count`, `test:issue-reports`, `test:integration*` (4 variants), `test:smoke*`, plus `check` / `build`. All executed commands below existed; none assumed.

## 2. Results matrix (all fresh today)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck -- --incremental false` (i.e. `tsc --noEmit --incremental false`) | **PASS** exit 0 (0 errors) |
| Lint | `npm run lint` (`eslint`) | **PASS w/ 16 warnings** — 0 errors, 16 warnings: unused-var warnings ×6 in tracked `lib/actions/appointmentReviewDecision.test.ts` / ×1 `appointmentReviewHistory.test.ts` / ×2 `tests/integration/bookingStagingReconcile.test.ts`, and the same ×9 mirrored inside `.codex-worktrees\pr219-reconcile` copies (lint reaches the registered worktree; warnings are non-blocking, identical set per Phase A baseline) |
| Unit/regression tests | `npm test` (node --test, 60+ files) | **667 pass / 0 fail / 0 skipped** (duration 7,689.6 ms output time) |
| Issue-report tests | `npm run test:issue-reports` | **5 pass / 0 fail** |
| Guard: tracked secrets | `npm run check:tracked-secrets` | **PASS** ("No secrets found in tracked files") |
| Guard: documented count | `npm run check:documented-count` | **PASS** ("total 667 matches the runner at this head (pass 667, fail 0)") |
| Guard: production build | `npm run check:production-build` | **PASS** (after fresh build, "Production-readiness guard passed") |
| Git integrity | `git fsck --full --no-progress` | **exit 0**; output = dangling-only (29 dangling commits / 4 blobs / 1 tree — historical session debris, no corruption) |

## 3. Fresh production build

| Item | Value |
|---|---|
| Command | `npm run build` (`next build`, unmodified config) — 2026-11-07 16:58:35 → 16:59:33 local |
| Wall time | ~58 s (Turbopack reused the fresh Phase A cache — compile phase 13.4 s; not a config change) |
| Outcome | **PASS** — `Compiled successfully in 13.4s` |
| Static pages | **40/40** generated (7 workers; final batch 2.4 s), incl. calendar routes (`/api/integrations/google-calendar/*`), WhatsApp routes (`/api/whatsapp/webhook`, `/api/ops/webhook-events`, `/api/outbound/draft`, `/api/internal/whatsapp/retry`), appointment reviews, health, and the dynamic-marked public pages |
| BUILD_ID | **`YlYbA_DahfD0FyTlwunD_`** (fresh; distinct from Phase A's `OfVBkeF8n3m2k39M-fnCm` — proves regeneration) |
| BUILD_ID file | `.next/BUILD_ID` written 2026-11-07 16:59:30 |
| Warnings/errors | log scan for `error|Error|warn|Warn|panic|Panic`: **zero matches** |
| OneDrive posture | client running before and during build; 26-file hash sweep hydrated successfully; no placeholders encountered; no Turbopack mmap/os-error-389 event occurred |
| Concurrency | only one build process; no parallel build launched |

## 4. Environment-gated / blocked items (honest classification)

| Suite | Class | Reason |
|---|---|---|
| `test:integration`, `test:integration:appointments`, `test:integration:booking-reconcile`, `test:integration:booking-ledger-run`, `test:integration:reconcile-history` | **BLOCKED** | require a local disposable Supabase project instance (none running/authorized; OD-02 OPEN). Not executed; no DB touched. |
| `test:smoke` / browser smoke | **BLOCKED (not attempted)** | requires served app + browser automation; exceeds "safe local tests" scope for this session; no alternative build config was used |
| `eval:ai:safety`, `verify:supabase:local` | **NOT RUN** | superseded by unit equivalents in this scope; categorized infrastructure-gated |
| External providers (Meta/Google/Vercel/Supabase hosted) | **BLOCKED** | policy — no external calls without explicit authorization |

## 5. Build-vs-baseline comparisons (no silent config changes)

- Phase A baseline (2026-11-07, earlier): BUILD_ID `OfVBkeF8n3m2k39M-fnCm`, 512 s full build, 40/40 routes, 667/667 tests, typecheck 0, lint 0E/16W, fsck exit 0 after hydration fix.
- This run: same tree (identical hashes in MH-C), same configs — fresh BUILD_ID, cache-warmed 58 s build, all checks repeated **exit-0-class**, lint warnings identical 16, tests identical 667/667. No drift detected.

## 6. Mutation-free confirmation

`git status --short --branch` after all verification runs: identical structure to session start (12 modified tracked, same untracked list, branch in sync). `.next/` (ignored) regenerated; log/audit artifacts written **outside the repo** under `Temp\opencode\`. Zero new commits; zero ref updates; zero config edits.

## 7. Verdict

Local verification suite: **PASS at every executable check** (2026-11-07). DB/environment-gated suites: **BLOCKED** with reasons. Nothing here implies production readiness: release decision remains owner-gated (NO-GO; see final report).
