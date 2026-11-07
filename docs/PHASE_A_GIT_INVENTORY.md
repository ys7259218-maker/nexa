# Phase A — Git Inventory & Integrity (Task A1 / A2)

**Audit date:** 2026-11-07 (Asia/Kolkata) · **Mode:** read-only inspection; no commits, no merges, no history changes · **Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa`

## 1. Repository identity

| Item | Value |
| --- | --- |
| Toplevel | `C:/Users/ys725/OneDrive/Documents/Default Project/nexa` |
| Current branch | `codex/appointment-integration-v1` |
| HEAD | `8c70be6eeb8d5dbabbbdcff515b8d55f67e69961` — `feat(calendar): staging-only Google Calendar OAuth connect flow - schema + routes + tests` |
| Tracking | `origin/codex/appointment-integration-v1` — in sync with HEAD (no divergence), per `git status --short --branch` |
| Remote | `origin https://github.com/ys7259218-maker/nexa.git` (fetch/push) |
| Merge-base main↔HEAD | `06679d9dbd169bb7f8204947250f197b9cee127d` |
| Stashes | None (`git stash list` empty) |

## 2. Branch divergence (Task A2)

| Comparison | Left unique | Right unique | Interpretation |
| --- | --- | --- | --- |
| `main` … `origin/main` | 0 | **18** | Local `main` (`06679d9`, `docs: record owner go-live approval intent … #181`) is **18 commits BEHIND** `origin/main`, not ahead. The previous audit's "main is 18 ahead" was inverted. |
| `main` … `HEAD` (current branch) | 0 | 159 | Current branch fully contains local `main`; nothing on local `main` is missing from HEAD. |
| `origin/main` … `HEAD` | **8** | 149 | `origin/main` has **8 commits** not reachable from the current working branch (list below). |

Commits in `origin/main` missing from current branch (`git log --oneline HEAD..origin/main`):

```
3c10dca test: reject unlisted recovery bundle contents (#223)
4210993 test: prove outbound finalizer success path in disposable CI database (#222)
141a81a test: replay staging appointment overlay on disposable CI database (#221)
5aaff15 fix(deps): update fast-uri to patched 3.1.8 (#220)
4f2967a ci/db: replay migrations and repair outbound finalizer (#219)
18b6acf docs: reconcile staging OAuth and production migration status (#217)
80cc24c fix: reject primary calendar alias in staging configuration (#218)
c2b2120 appointment-booking staging integration: calendar provider, sandbox E2E, server-only adapter, live staging reconcile (#215)
```

Notes:

- These 8 commits include **#218 (reject `'primary'` calendar alias)** — the uncommitted working-tree change in `lib/calendar/googleCalendarGate.ts` already re-implements the same guard (`normalizeStagingCalendarId` rejects `primary`), so a future reconcile must be checked for duplicate/conflicting logic.
- **No merge, rebase, or cherry-pick was performed in Phase A** (owner-authorization required). Conflict surface for a future reconcile is expected around `app/api/integrations/google-calendar/*`, `lib/calendar/*`, `lib/deployPreflight.ts`, booking adapter files (#215/#219), and dependency pins (#220).
- The `migration-replay-ci` PR-reconcile branch (`codex/migration-replay-ci` @ `3e02172`, "Merge origin/main into codex/migration-replay-ci (reconcile PR #219)") is already checked out in the `.codex-worktrees/pr219-reconcile` worktree — see §5.

## 3. Working tree inventory

### 3.1 Modified tracked files (12) — all preserved, none staged

`git diff --cached --stat` is empty (no staged changes). `git diff --stat`: 12 files, **+248/−44**:

| File | Δ | Classification / risk |
| --- | --- | --- |
| `NEXA_HANDOFF.md` | +5 | Docs note for OpenAI gate relaxation (2026-10-04). Low risk. |
| `docs/GO_LIVE.md` | +4 | Same note mirrored. Low risk. |
| `app/api/integrations/google-calendar/callback/route.ts` | 11 | Calendar OAuth changes — see `PHASE_A_CALENDAR_REVIEW.md`. Medium (in-flight feature; byte-identical stray copy exists at repo root). |
| `app/api/integrations/google-calendar/configure/route.ts` | 8 | Calendar changes — reviewed. Medium. |
| `app/api/integrations/google-calendar/connect/route.ts` | 7 | OAuth cookie max-age 600s → 3600s + production-flag plumbing. Medium. |
| `app/api/integrations/google-calendar/disconnect/route.ts` | 1 | Production-flag plumbing only. Low. |
| `app/api/integrations/google-calendar/status/route.ts` | 1 | Production-flag plumbing only. Low. |
| `app/settings/team/page.tsx` | 109 | Team-settings page rewritten as proper JSX + Google Calendar status panel. Low (UI; unit/typecheck-verified). |
| `lib/calendar/googleCalendarGate.ts` | 56 | Adds `GOOGLE_CALENDAR_PRODUCTION_ENABLED` production branch + `normalizeStagingCalendarId` (rejects `primary`). **Semantic change of a security gate** — reviewed in calendar doc. Medium. |
| `lib/calendar/googleCalendarGate.test.ts` | +24 | New production-gate tests (rejected staging URL, malformed URLs). Low. |
| `lib/deployPreflight.ts` | 33 | `AI_PROVIDER=openai` fail-closed acceptance (`OPENAI_API_KEY` + `OPENAI_MODEL` required); TEAM_MANAGEMENT_ENABLED moved out of auto-approved beta flags; inbound-var grouping. Medium. |
| `lib/deployPreflight.test.ts` | +33 | Tests for the same. Low. |

### 3.2 Untracked entries (6)

| Path | Classification / risk |
| --- | --- |
| `page.tsx` (repo root) | **Stray duplicate.** Byte-level `git diff --no-index` vs `app/settings/team/page.tsx`: only a 1-line rendering difference (`Joined{" "}` vs `Joined `) — i.e. it duplicates the Team Settings page. mtime 2026-10-02 23:03:38. **Preserved; not deleted** (Phase A rule). Owner should reconcile/delete after review. |
| `route.ts` (repo root) | **Stray byte-identical copy** of `app/api/integrations/google-calendar/callback/route.ts` (git blob `be02b45` identical, 3726 bytes; mtime 2026-10-02 23:03:26). Harmless to build output presence but dangerous clutter. **Preserved; owner to delete after review.** |
| `components/calendar/GoogleCalendarConnection.tsx` | New client component referenced by the modified team-settings page. Required by current working tree; **do not delete**. |
| `docs/BLUEPRINT_PERCENTAGE.md` | User-generated doc ("Generated from live production state 2026-09-16"). Preserve. |
| `docs/STAGING_OAUTH_CONSENT_RUNBOOK.md` | Owner runbook for the staged OAuth consent. Preserve (see calendar doc). |
| `.codex-worktrees/` | Real git worktree registered for `codex/migration-replay-ci` (clean status; contains `pr-body.txt`, `OPENCODE_HANDOFF.md`). **User work — untouched.** |

### 3.3 Unexpected generated files

- `.next/` (gitignored, `/​.next/` per `.gitignore:24`) — build output from 2026-10-02; staleness investigated in `PHASE_A_VERIFICATION_REPORT.md` (root cause: OneDrive cloud-placeholder hydration failure, not git state).
- `.vercel/` (gitignored), `node_modules/` (gitignored) — expected.
- No `*.pem`, no front-of-repo recovery archives (`/backup-v*/`, `recovery-artifacts/` ignored patterns) observed at root.

## 4. Git integrity (Task A2) — broken references: root cause and resolution

Initial read-only scan reproduced **4 unreadable refs** and `git fsck --full` errors:

```
refs/heads/opencode/cycle5-task
refs/remotes/origin/opencode/cycle5-task
refs/remotes/origin/dependabot/npm_and_yarn/framer-motion-13.2.0
refs/remotes/origin/dependabot/npm_and_yarn/types/node-26.5.1
error: cannot read ref file ...: Invalid argument
error: ...: invalid sha1 pointer 0000000000000000000000000000000000000000
```

**Root cause (verified, not corruption):** those four ref files were **OneDrive "cloud-only" placeholders** (attributes `4199968` = RECALL_ON_DATA_ACCESS + REPARSE_POINT + OFFLINE) while the OneDrive client was **not running** ("The cloud file provider is not running" on every read attempt; git saw the same OS error and printed `Invalid argument`). The object database itself was never damaged.

**Resolution (environment-only, no git data written):** the user's OneDrive client was started; after it came up, all four ref files hydrated normally:

```
refs/heads/opencode/cycle5-task                                   -> b9b49387e1cb6fadcde5dd6cd225bbc63fe4c5ef
refs/remotes/origin/opencode/cycle5-task                          -> b9b49387e1cb6fadcde5dd6cd225bbc63fe4c5ef
refs/remotes/origin/dependabot/npm_and_yarn/framer-motion-13.2.0  -> 196af75add7f372e462514c9d2eb489fccc963ca
refs/remotes/origin/dependabot/npm_and_yarn/types/node-26.5.1     -> 72a565360089b2aad582aec208effc4a60b6346a
```

Post-resolution `git fsck --full --no-dangling` → **exit 0, no errors, no missing objects**. `opencode/cycle5-task`'s commit object exists locally, so no unique work is lost; the dependabot refs point at their respective merge-requests and remain available for reference. No ref was deleted; no destructive cleanup was run (`gc --prune`, `prune`, `reset` were not executed).

**Worktree inventory (`git worktree list`):**

| Worktree | Branch | Status |
| --- | --- | --- |
| `…\Default Project\nexa` | `codex/appointment-integration-v1` @ `8c70be6` | Main checkout (this repo) |
| `…\Default Project\nexa\.codex-worktrees\pr219-reconcile` | `codex/migration-replay-ci` @ `3e02172` | Registered worktree, clean tree; user work — preserved |
| `C:\Users\ys725\AppData\Local\Temp\opencode\nexa-candidate-d820996` | `codex/recovery-runbook` @ `d64d163` | Registered but directory missing → `prunable` |
| `C:\Users\ys725\AppData\Local\Temp\opencode\nexa-completion-audit` | `codex/completion-final` @ `c1fb463` | Registered but directory missing → `prunable` |
| `C:\Users\ys725\AppData\Local\Temp\opencode\nexa-safecycle4` | `opencode/cycle4-task` @ `5d920c4` | Registered but directory missing → `prunable` |
| `C:\Users\ys725\AppData\Local\Temp\opencode\nexa-safecycle6` | `opencode/cycle6-task` @ `d820996` | Registered but directory missing → `prunable` |

The four `prunable` entries are Temp-dir worktrees whose directories were wiped by Temp cleanup. The underlying **branches and commits are intact** (all resolve). Their registration rows are stale bookkeeping only. `git worktree prune` was **not run** — flagged as a safe-but-postponed tidy-up for owner convenience.

## 5. Branch overview

`git branch -vv` (after hydration) shows ~120 local branches; notable non-current ones: `main` (behind origin/main 18), `codex/completion-audit`, `codex/completion-final` (worktree on Temp — see above), `codex/database-privilege-hardening-v1`, `codex/recovery-runbook`, `docs/reconcile-operational-truth-v1`, plus the historical `opencode/*` feature-branches. Several have `origin/...: gone` upstream (upstream deleted on GitHub) — informational only.

## 6. Original session hygiene

- `.git/HEAD` → `ref: refs/heads/codex/appointment-integration-v1`; kein detached state.
- `packed-refs` (11.5 KB, 2026-09-19) coexists with loose refs; consistent after hydration.
- `FETCH_HEAD` present (2026-09-30) — no Phase A fetch was performed (offline-friendly; nothing fetched/pushed).

## 7. Risk register summary

| # | Risk | Severity | Recommended action |
| --- | --- | --- | --- |
| R1 | uncommitted calendar/OAuth/preflight work (12 files) not yet committed or merged | Medium | Owner reviews `PHASE_A_CALENDAR_REVIEW.md`, then authorizes commits + reconcile with `origin/main` (8 commits) |
| R2 | root strays `page.tsx`, `route.ts` | Low-Med | Owner deletes the two strays (route.ts is byte-identical; page.tsx near-identical) — deletion deliberately NOT performed |
| R3 | local `main` 18 behind `origin/main` | Low | Owner authorizes `git pull`/`fetch` fast-forward of `main` (no worktree conflict: main is not checked out anywhere) |
| R4 | 4 stale Temp worktree registrations (`prunable`) | Low | Owner-approved `git worktree prune` |
| R5 | OneDrive placeholder dependence of `.git/refs` and `node_modules` | High (environmental) | Keep OneDrive running or "Always keep on this device" for `.git` + `node_modules/next/dist/bin` (`PHASE_A_VERIFICATION_REPORT.md` documents the fresh-build impact) |
| R6 | duplicate `primary`-alias logic between #218 (origin/main) and the uncommitted `googleCalendarGate.ts` | Medium | Resolve during reconcile; keep one implementation |

## 8. Commands actually executed (selection)

```
git rev-parse --show-toplevel
git status --short --branch          (and --porcelain=v1 -b)
git log -8 --oneline --decorate
git remote -v ; git stash list ; git worktree list
git branch -vv ; git for-each-ref (implicit via branch/rev checks)
git diff --cached --stat ; git diff --stat
git rev-list --left-right --count main...origin/main | main...HEAD | origin/main...HEAD
git log --oneline main ^origin/main ; git log --oneline HEAD..origin/main
git merge-base main HEAD
git fsck --full --no-dangling        (twice: before/after hydration)
git rev-parse <ref> × 4 (broken refs)
git hash-object (stray comparison) ; git diff --no-index (page.tsx pair)
```

No commit, merge, rebase, checkout, push, pull, ref write, or `gc/prune/reset` was executed. Working tree files were not modified by these commands.
