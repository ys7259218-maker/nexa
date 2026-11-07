# Phase A — Application Verification & Fresh Build Report (Task A5 + A6)

**Audit date:** 2026-11-07 · **All results reproduced fresh on the exact working tree under audit** (`codex/appointment-integration-v1` @ `8c70be6` + the 12-file uncommitted calendar/preflight work). Results log: `Temp\opencode\phase-a\verify-results.txt` (+ `lint-verify2.txt`, `build3_meta.txt`, `nextbuild3.log`, `npm-audit-summary.txt`).

## 1. Task A5 — script-exact verification results

| # | Check (exact command) | Start (UTC) | Exit | Result detail |
| --- | --- | --- | --- | --- |
| 1 | `npm run typecheck -- --incremental false` | 2026-11-07T11:07:09Z | **0** | 0 errors, ~17s |
| 2 | `npm run lint` | right after | **0** (after artifact relocation — see §3) | **0 problems counted as errors; 16 warnings**, all pre-existing unused-var patterns in `lib/actions/appointmentReview{Decision,History}.test.ts`, `tests/integration/bookingStagingReconcile.test.ts`, and the user's `.codex-worktrees/pr219-reconcile` mirror copies; dur 25–33s |
| 3 | `npm test` | 2026-11-07T11:07:xxZ | **0** | **tests 667 / pass 667 / fail 0 / cancelled 0 / skipped 0** (dur 8.9–17.7s across runs today) |
| 4 | `npm run check:documented-count` | same run batch | **0** | "documented unit-test total 667 matches the runner at this head (pass 667, fail 0)" |
| 5 | `npm run check:tracked-secrets` | same run batch | **0** | "Tracked-secret guard passed. No secrets found in tracked files." |
| 6 | `npm run check:production-build` | same run batch | **0** | "Production-readiness guard passed. No values were printed." |
| 7 | `npm run test:issue-reports` | same run batch | **0** | tests 5 / pass 5 / fail 0 |
| 8 | `npm audit --json` (metadata query) | ~10:00Z | **1** | 19 findings: 2 critical, 5 high, 12 moderate (see `PHASE_A_SECURITY_AUDIT.md`) — not remediated in Phase A by rule |

Reproducibility: every step re-executeable offline except `npm audit` (registry metadata) and the environment note in §2. Results were also reproduced in the same-day earlier runs (typecheck/lint/tests/guards), so they are stable, not single-shot.

Policy adherence: no test was skipped/weakened; no assertion was reduced; the only failures encountered were environmental (§2, §3) and were resolved without changing repository source.

## 2. Task A6 — fresh production build verification — **PASS**

### 2.1 First-pass environment investigation (required context)

The working tree is inside a **OneDrive** folder. During this audit the OneDrive client was not running, which left some files as "cloud-only placeholders" (os error 389 / errno -4094, "cloud file provider is not running"). Direct evidence chain:

1. Attempt 1 (`node node_modules\next\dist\bin\next --version and build`): `UNKNOWN: unknown error, read` loading `next/dist/bin/next` — **0.3 s, exit 1, nothing written to `.next`** (explains the earlier无故 "exit 0 but stale `.next`" observation: captured wrapper semantics swallowed the failure pattern; `npm` banner appeared while the child crashed instantly).
2. Attempt 2 after OneDrive hydration of `node_modules`: Next.js v16.3.4 starts, but **Turbopack panics reading its persistent cache**: `Failed to mmap SST file .next\cache\turbopack\v16.3.4-…\00000014.sst ... The cloud operation was unsuccessful (os error 389)`; exit `0xC0000409`. The prior Oct `.next` cache files were placeholders.
3. Script-level probes confirmed: `cldflt` driver Running but **OneDrive process absent**; placeholder attributes `4199968` (RECALL_ON_DATA_ACCESS + REPARSE_POINT + OFFLINE).

Environment remediation (no repo file changed): the **OneDrive client was started**; placeholders hydrate on demand afterwards.

### 2.2 Preservation procedure (per prompt §8: "carefully preserve existing generated build artifacts before regenerating")

- Existing `.next` (2026-10-02 artifacts, incl. placeholder cache) was **renamed** (never deleted) to `.next.phase-a-frozen-20261107`, then moved intact to `Temp\opencode\phase-a\frozen-next-20261107` for preservation outside the repo (so ESLint's `.next` ignore semantics could not accidentally scan generated files — removing it from the repo restored lint to its correct baseline; see §3).
- The destination copy is byte-identical by `Move-Item` semantics; it is retained for owner review and can be deleted later at owner discretion.

### 2.3 Fresh build — verified

| Item | Value |
| --- | --- |
| Command | `node node_modules\next\dist\bin\next build` (Next **16.3.4**, Turbopack) |
| Start (UTC) | 2026-11-07T10:58:05Z |
| End / duration (UTC) | 2026-11-07T11:06:38Z · 512 s |
| Exit code | **0** |
| Freshness evidence | entire `.next` regenerated during this run: `BUILD_ID` = `OfVBkeF8n3m2k39M-fnCm` (2026-11-07 16:36:34 local), plus `routes-manifest.json`, `prerender-manifest.json`, `app-path-routes-manifest.json`, `images-manifest.json`, `export-marker.json`, `trace`, `trace-build` all timestamped 2026-11-07 16:34–16:36 local |
| Output check | full route table printed: 40/40 pages prerendered (static pages using 7 workers), all expected routes present (including `/api/integrations/google-calendar/*` and every settings/dashboard page); `Proxy (Middleware)` emitted |
| Strays | root `page.tsx` / `route.ts` produced **no routes** in the build output (inert duplicates) |
| Warnings | `clientTraceMetadata` experimental flag noted by Next (info-level); no build errors |

Classification: **PASS — fresh build verified** (exit 0 AND artifact freshness AND route-table evidence).

### 2.4 Residual environmental risk (documented, not repo-defect)

If the OneDrive client stops again, cloud-placeholder files inside `.git/refs` and `.next/cache` will fail reads/hydration with the same symptoms (broken-look refs / Turbopack cache mmap panic). Recommendation for owner: keep OneDrive running during development, or mark `.git` and `node_modules` (and optionally `.next`) as "Always keep on this device". No repository change was made for this.

## 3. Artifact-relocation after-effect (transparent correction)

Intermediate verification run #2 recorded `npm run lint` **exit 1 with 109 errors/110 warnings**. Cause investigation: the preserved-then-named directory `.next.phase-a-frozen-20261107` inside the repo was not covered by `eslint-config-next`'s automatic `.next` ignore, so ESLint scanned generated build files. Moving the preserved snapshot out of the repo (§2.2) restored lint to **exit 0 / 0 errors / 16 warnings** (identical to the morning baseline). This was an audit-procedure artifact, not a repository defect, and both runs are logged for transparency.

## 4. Skipped checks (with reasons)

| Check | Reason |
| --- | --- |
| Integration suites (`test:integration*`) | Need hosted/disposable DB credentials — BLOCKED (owner-gated; also D7-OD-02) |
| `test:smoke` (browser smoke) | Exceeds the external-access boundary of Phase A; fresh build exists, but smoke requires deployed environments this audit must not touch |
| Wallet/WhatsApp live checks | Out-of-bounds by design (production pipeline untouched) |

## 5. Bottom line

Application baseline is **verified green offline**: typecheck 0/0, lint 0 errors/16 warnings, tests 667/667, all guards pass, and — for the first time on this machine — a **genuinely fresh** production build verified end-to-end (`BUILD_ID OfVBkeF8n3m2k39M-fnCm`, exit 0, 512 s). The sole non-green item is `npm audit` (19 metadata findings) which is owner-decision territory per Phase A rules.
