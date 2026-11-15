# DEXYBOR Stage F — MERGE & HARDEN: EVIDENCE REPORT

**Report ID:** OD01-SF-8 · **Date:** 2026-11-08 (PKT) · **Status:** `COMPLETE — PR OPEN — AWAITING OWNER REVIEW/MERGE`
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` · **Remote:** `ys7259218-maker/nexa`
**Branch:** `codex/merge-harden-integration` @ `0ed49b8` · **PR:** [#230](https://github.com/ys7259218-maker/nexa/pull/230) → `main` @ `3279ac2`

---

## 1. Authorization and pins

| Instrument | SHA-256 | State |
|---|---|---|
| `docs/OD01_MINI_AUTHORIZATION_SIGNED.md` | `0FE855A746F2ED33B3339530219D5A0817B4A669060E161F08D639BB8B4FA5A3` | signed by owner |
| `docs/OD01_MINI_EXECUTION_INSTRUCTION_SIGNED.md` | `B5B99703A91EE3298AD283627A4BFBA7776FE414AB3368C6F177FFE20DED6FAF` | signed by owner |
| `docs/OD01_STAGE_F_REBASELINE_AMENDMENT_SIGNED.md` | `332C1AE668261F0BBE02FC8006371C8921DD5D3BDC746261252091F58F0CAB12` | signed by owner |
| `docs/OD01_STAGE_F_REBASELINE_ANALYSIS.md` | `8A192E7CF23DFEB357BBE02AFA582E2E3A0344E42DF7835A41B3905E6D0C84C4` | read-only analysis |

- Merge source amended from `3c10dca` to **`3279ac2cfd7386ab5adef35b37f43382772c2aaa`** (45 commits) per the signed amendment.
- `origin/main` was re-verified immediately before push and before PR creation: still `3279ac2`. No drift occurred during the run.
- Validity: 14 days from 2026-11-07/08. No scope change, HEAD change, or failed gate occurred.

## 2. Execution chain

| Commit | Message | Content |
|---|---|---|
| `e72a3c8` | Preserve pre-Stage-F working tree (MH-C baseline) | 48 files, +4121/−44: 12 modified tracked files + 36 added (planning docs, originals, signed instruments) |
| `f5058ff` | Merge `origin/main` @ `3279ac2` into `codex/merge-harden-integration` | 45 upstream commits integrated; 15 conflicts resolved |
| `0ed49b8` | Harden dependencies to signed MH-E floors | `package.json`, `package-lock.json`, dependency update log |

Branch base: `8c70be6` (`codex/appointment-integration-v1`). Root strays `page.tsx`, `route.ts` and `.codex-worktrees/` were never staged or committed.

## 3. Step results

| Step | Result |
|---|---|
| 1. Preservation copy + manifests | **PASS** — `%TEMP%\opencode\phase-h\preserve-20261108-0015`; 2,121/2,123 files copied; 476 source-tree files hashed; 50 key files hashed, **0 mismatches**; 2 cloud-only stale-worktree metadata files excepted |
| 2. Branch creation | **PASS** — `codex/merge-harden-integration` from `8c70be6`; no new worktree |
| 3. Preserved-work commit | **PASS** — `e72a3c8`; no deletions; root strays excluded |
| 4. Merge `origin/main` @ `3279ac2` | **PASS** — `f5058ff`; 15 conflicts resolved after per-file review; zero conflict markers |
| 5. Dependency floors | **PASS** — `0ed49b8`; exactly 7 signed floors; restricted lockfile; no `npm audit fix`/`--force` |
| 6. Full verification + fresh build | **PASS** — `npm run check` exit 0; build ID `6d3mEczlbEckwbnbRSKZH` |
| 7. PR creation | **PASS** — PR #230 open, mergeable, head `0ed49b8`, base `3279ac2`; not merged/modified/closed |
| 8. Evidence report | **PASS** — this report + hashed evidence pack |

## 4. Merge and conflict resolution

45 commits were merged from `3279ac2`. The 15 conflicted files were each compared (ours vs main) before resolution:

```text
NEXA_HANDOFF.md
docs/APPOINTMENT_BOOKING_STAGING_RECONCILE.md
docs/BLUEPRINT_PERCENTAGE.md
docs/GO_LIVE.md
docs/GOOGLE_CALENDAR_OAUTH_STAGING.md
docs/schema-proposals/appointment_booking_ledger_v1.sql
lib/actions/googleCalendarSchemaContract.test.ts
lib/deployPreflight.test.ts
lib/deployPreflight.ts
lib/server/googleCalendarStore.ts
lib/server/googleCalendarStoreContract.test.ts
lib/workspaceMigrations.test.ts
package.json
tests/integration/bookingStagingReconcile.test.ts
tests/integration/README.md
```

**Resolution rule applied:** main's newer version won per file because the local side was an older duplicate/subset already contained in main (verified in the read-only re-baseline analysis). No blind `-X ours/theirs`; no unique local work discarded; all pre-merge bytes retained in the preservation copy. `package.json` was then edited in Step 5 only for the signed floors. `c2b2120` / PR #215 remains deferred and untouched.

## 5. Dependency floors and audit

### Direct changes (exactly the signed MH-E floors)

| Package | Before | After |
|---|---|---|
| `next` | `^16.3.2` (16.3.4) | `^16.4.1` (**16.4.5**) |
| `@sentry/nextjs` | `10.74.0` | **`10.78.0`** |
| `sharp` | 0.35.4 | **0.35.5** (override) |
| `source-map-js` | 1.2.1 | **1.2.2** (override) |
| `fast-uri` | 3.1.6 | **3.1.9** (override) |
| `zod` | 4.4.3 | **4.6.6** (override) |
| `brace-expansion` | 1.1.18 / 5.0.9 | **1.1.21 / 5.0.12** (overrides) |

### Authorized transitive fallout (required by the upgraded graph)

| Transitive | Change | Required by |
|---|---|---|
| `ajv-formats` | 2.1.1 → 3.0.1 | `schema-utils@4.8.3` via `webpack@5.112.2` inside `@sentry/bundler-plugins@10.78.0` |
| `dotenv` | 16.6.1 → 17.4.2 | `@sentry/bundler-plugins@10.78.0` requires `^17.4.2` |
| `es-module-lexer` | 2.3.2 → 3.0.4 | `import-in-the-middle` via `@sentry/node@10.78.0` requires `^3.0.4` |
| `brace-expansion` | 1.1.18 → 1.1.21 · 5.0.9 → 5.0.12 | signed overrides |
| `@opentelemetry/*` | refreshed | `@sentry/node@10.78.0` graph |

Lockfile: 386 insertions / 578 deletions · 78 changed-or-added entries · 21 removed entries. No unauthorized direct major bump. Full detail: `docs/MERGE_HARDEN_DEPENDENCY_UPDATE_LOG.md` (git blob `d9d2872`).

### Audit

| Severity | Before | After |
|---|---|---|
| Critical | 2 | **0** |
| High | 4 | **0** |
| Moderate | 13 | 12 |
| Low | 0 | 0 |
| **Total** | **19** | **12** |

Raw JSON: `%TEMP%\opencode\stagef-audit-before.json` (`5BED6802…`) · `%TEMP%\opencode\stagef-audit-after.json` (`799BAA08…`). Remaining moderates are the known build-tool chains, documented and not silently fixed.

## 6. Verification (`npm run check`)

**Command exit code: 0.** Log: `%TEMP%\opencode\stagef-check-20261108-002237.log` (104,783 B, SHA-256 `18CA9DCCA2964EDF9BFE0EB370EC99F82E7541132B2381AFB8FD4B31028BAA69`).

| Gate | Result |
|---|---|
| `check:tracked-secrets` | pass |
| `check:production-build` | pass — no values printed |
| `check:documented-count` | **693** documented = runner |
| `lint` | **0 errors**, 16 pre-existing warnings |
| `typecheck` | clean |
| `test` | **693 pass / 0 fail** |
| `test:issue-reports` | **5 pass / 0 fail** |
| `build` | **success** — Next.js 16.4.5 (Turbopack), compiled 16.5s, TypeScript 15.6s, 43 routes, build ID `6d3mEczlbEckwbnbRSKZH` |

No red gate occurred, so the signed STOP condition was not triggered.

### Remote CI on PR #230 (read-only verification)

| Check | Result |
|---|---|
| Dependency audit | **pass** (36s) |
| Lint, typecheck, test, and build | **pass** (2m6s) |
| Local migration replay | **pass** (3m0s) |
| Tracked-secret guard | **pass** (10s) |
| Vercel preview checks | **pass** (platform preview builds) |

CI run `42403811640` completed **success** in 3m3s. The Vercel checks were created automatically by the repository's GitHub integration when the PR was opened; the operator ran no deploy command and promoted no deployment. Production was not touched.

## 7. Publication

- PR **#230** — https://github.com/ys7259218-maker/nexa/pull/230
- Title: `DEXYBOR Stage F — integration & hardening`
- State: **OPEN**, mergeable `MERGEABLE`
- Head: `codex/merge-harden-integration` @ `0ed49b8974d46f7fd0672b4c8de3cdd818e1cd30`
- Base: `main` @ `3279ac2cfd7386ab5adef35b37f43382772c2aaa`
- The operator did **not** merge, modify, or close the PR. R6 explicitly prohibits PR modify/close; therefore this report is retained as local evidence and was not committed/pushed after PR creation.

### PR scope audit (read-only)

Diff vs `main`: **37 files, +4092/−580** — **35 documentation files** (Phase A reports, MH/OD/DEXYBOR planning docs, signed instruments) plus `package.json` and `package-lock.json`. **Zero application code, config, migration, workflow, secret, or deploy files.** Root strays (`page.tsx`, `route.ts`) and `.codex-worktrees/` are absent from the diff. No `.env` file appears in the diff.

## 8. Preservation and exceptions

- Preservation copy: `%TEMP%\opencode\phase-h\preserve-20261108-0015`
- `MANIFEST_KEY_FILES_SHA256.txt` — 50 key files, 0 mismatches, SHA-256 `F6B0FC11635792116B9F403FD7F73F5EFF513D03A5E61838A408C42F6065CE14`
- `MANIFEST_SOURCE_TREE_SHA256.txt` — 476 source-tree files, SHA-256 `85F68783A7C452C0B38EC17B4F5D110CFD2A84E8C86D70D19D3015B6F479662A`
- `RUN_LOG.txt` — SHA-256 `1EA5DDBF728AD94770971BF4A811CE60ED61D800330FF5C94432E10F316A024E`
- **Final integrity re-check (after PR creation):** key-file manifest **50/50 match, 0 missing**; source-tree manifest **476/476 match, 0 missing**. No corruption or drift.
- **Known exception:** `.git/worktrees/nexa-safecycle5/COMMIT_EDITMSG` and `FETCH_HEAD` are OneDrive cloud-only placeholders; the provider did not serve them despite starting OneDrive (PID 7760). These are stale worktree metadata only; the working tree and all source files were copied and hashed successfully. No source file was affected.

## 9. Safety attestation

- No deploy command was run, no production access, no production migrations, no live OAuth.
- PR creation automatically triggered the repository's Vercel **preview** checks (platform behavior); no deployment was promoted and no production alias was changed.
- WhatsApp outbound remains **`false`**; no outbound configuration changed.
- No direct push to `main`; no force-push; no history rewrite; no guard weakening.
- No secret values were printed or committed; the production-build guard printed no values.
- `c2b2120` / PR #215 remains deferred and untouched.
- Root strays `page.tsx`, `route.ts` and `.codex-worktrees/` remain untracked and untouched.
- No other branch, worktree, or PR was modified.

## 10. Evidence index

| Artifact | Location | Hash |
|---|---|---|
| Verification log | `%TEMP%\opencode\stagef-check-20261108-002237.log` | `18CA9DCC…BAA69` |
| Audit before | `%TEMP%\opencode\stagef-audit-before.json` | `5BED6802…62577` |
| Audit after | `%TEMP%\opencode\stagef-audit-after.json` | `799BAA08…3DE0` |
| Key-file manifest | preservation copy | `F6B0FC11…CE14` |
| Source-tree manifest | preservation copy | `85F68783…662A` |
| Preservation run log | preservation copy | `1EA5DDBF…024E` |
| Dependency update log | `docs/MERGE_HARDEN_DEPENDENCY_UPDATE_LOG.md` | git blob `d9d2872` |
| Signed authorization | `docs/OD01_MINI_AUTHORIZATION_SIGNED.md` | `0FE855A7…A5A3` |
| Signed instruction | `docs/OD01_MINI_EXECUTION_INSTRUCTION_SIGNED.md` | `B5B99703…6FAF` |
| Signed amendment | `docs/OD01_STAGE_F_REBASELINE_AMENDMENT_SIGNED.md` | `332C1AE6…AB12` |

## 11. Owner action

Review PR #230 and merge it if satisfied. No further operator action is authorized after this report; Phase B requires a new explicit owner instruction.

**Status: `STAGE F COMPLETE — PR #230 OPEN — OWNER MERGE ONLY`**
