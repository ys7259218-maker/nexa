# DEXYBOR AI — MERGE & HARDEN: GIT DIVERGENCE ANALYSIS

**Report ID:** MH-B · **Stage:** B (Reconciliation analysis) · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` · remote `origin` = `https://github.com/ys7259218-maker/nexa.git`
**HEAD at analysis:** `8c70be6` (`codex/appointment-integration-v1`, tracking in sync) · **mode: read-only**

---

## 1. Verified refs

| Ref / state | Value |
|---|---|
| `HEAD` | `8c70be6eeb8d5dbabbbdcff515b8d55f67e69961` — branch `codex/appointment-integration-v1`, in sync with `origin/codex/appointment-integration-v1` |
| local `main` | `06679d9dbd169bb7f8204947250f197b9cee127d` — `[origin/main: behind 18]` |
| `origin/main` | `3c10dca9b369fb1b1fe8ba847c6b40075091763e` |
| merge-base `main` ↔ `origin/main` | `06679d9` (i.e. local `main` is simply behind; zero unique) |
| merge-base `HEAD` ↔ `origin/main` | `25ddac2df71ef696cfd04259c64abf3098c9ea0b` |

## 2. Divergence counts (fresh, 2026-11-07)

| Command | Left (first) | Right (second) | Reading |
|---|---|---|---|
| `rev-list --left-right --count origin/main...main` | 18 | 0 | origin/main ahead 18; local main has **no unique commits** |
| `rev-list --left-right --count origin/main...HEAD` | 8 | 149 | 8 commits exist only on origin/main; 149 only on the feature branch |
| `rev-list --left-right --count main...HEAD` | 0 | 159 | feature branch fully contains local `main` plus more work |
| `git cherry -v HEAD origin/main` | — | — | **empty**: no incoming commit is patch-id-equivalent to anything on HEAD |
| incoming subjects matching /revert/i | — | — | none |

Diffstat context: `main..origin/main` = 111 files changed (+7471/−95); `origin/main...HEAD` = 78 files changed (+5508/−5).

**Integrity:** fresh `git fsck --full` exit 0 (2026-11-07). Output is *dangling-only*: 29 dangling commits, 4 dangling blobs, 1 dangling tree (historical detached-session debris; harmless, referenced nothing broken). No checks failed.

**Worktrees / inventory touches:** 2 real worktrees (main repo + `.codex-worktrees/pr219-reconcile` = branch `codex/migration-replay-ci` @ `3e02172`, clean) and 5 stale `prunable` registrations for deleted Temp dirs (branches intact; `worktree prune` deferred per authorization review). No stashes. Side-note: `opencode/integration-issue-report-cleanup-v1` tracks `origin/main` (ahead 2, behind 17) — an old lineage branch, irrelevant to this reconciliation and left untouched.

## 3. The eight incoming commits (`HEAD..origin/main`)

Commit-by-commit review. Patch-id equivalence: **none** (cherry empty). "Infra" = CI/harness; "Dep" = dependency/lockfile. Semantic-overlap notes are consequences of independent parallel lineages, not evidence a change is already merged.

| # | Hash | Subject (ref) | Date | Summary of change | Purpose / security implication | Conflict risk | Disposition (proposed) |
|---|---|---|---|---|---|---|---|
| 1 | `c2b2120` | appointment-booking staging integration: calendar provider, sandbox E2E, server-only adapter, live staging reconcile (#215) | 2026-09-27 | ~24 files: 5 calendar OAuth routes, appointment-reviews UI + API, calendar-provider abstraction & E2E, 12 docs, CI workflow additions, .env.example entries, handoff | Establishes provider-side baseline of the appointment/calendar feature. Security: staging-only OAuth wiring, server-only adapter boundary. Potential conflicts: the parallel branch implemented overlapping calendar code | **High** (calendar routes / booking ledger / docs) | **OWNER REVIEW REQUIRED** — include content, resolve overlaps by review, not by side-picking |
| 2 | `80cc24c` | fix: reject primary calendar alias in staging configuration (#218) | 2026-09-28 | 4 files +27/−7: `googleCalendarGate.ts`, `configure/route.ts`, `googleCalendarStore.ts`, store contract test | **Security guard**: rejects the provider's implicit `primary` alias so writes target an explicit calendar only. Not patch-present on the branch (see §4) | Medium (gate/store files diverged on the branch) | INCLUDE |
| 3 | `18b6acf` | docs: reconcile staging OAuth and production migration status (#217) | 2026-09-28 | 5 files: NEXA_HANDOFF, GOOGLE_CALENDAR_OAUTH_STAGING, GO_LIVE, STAGING_SCHEMA_RECONCILE doc, docs-truth test | Truth-reconciliation of operational docs — protects against false "done" claims | Low-Med (docs overlap with locally modified GO_LIVE/HANDOFF) | INCLUDE |
| 4 | `4f2967a` | ci/db: replay migrations and repair outbound finalizer (#219) | 2026-09-28 | CI workflow +~27, new Outbound migration SQL finalizing repair, handoff/GO-LIVE docs, migration-history tests | Migration *source additions* + CI harness. No migration executed here | Low-Med (docs; migration chain) | INCLUDE (files only; execution stays blocked) |
| 5 | `5aaff15` | fix(deps): update fast-uri to patched 3.1.8 (#220) | 2026-09-29 | package-lock 3 lines | **Security dep fix** for then-current fast-uri advisories. Fresh advisories now require ≥3.1.9 — #220 alone is necessary but no longer sufficient | Low (package.json uncommitted divergence possible) | INCLUDE + supersede with ≥3.1.9 in the dependency cycle (Security Remediation report) |
| 6 | `141a81a` | test: replay staging appointment overlay on disposable CI database (#221) | 2026-09-29 | 9 files: CI job, staging-replay TS/SQL harnesses, docs, tests, package.json script | Test/audit harness only; disposable-DB CI usage is OD-02-gated | Low | INCLUDE |
| 7 | `4210993` | test: prove outbound finalizer success path in disposable CI database (#222) | 2026-09-29 | 2 files: verifyLocalSupabase +  endpoint SQL verifier | Outbound message-send proof harness (CI/disposable DB). No runtime send | Low | INCLUDE |
| 8 | `3c10dca` | test: reject unlisted recovery bundle contents (#223) | 2026-09-30 | 3 files: recovery-bundle verifier + tests + CI | Anti-supply-chain guard: recovery bundle must contain no unlisted files | Low | INCLUDE |

Totals: **INCLUDE 7 (proposed), OWNER REVIEW REQUIRED 1, EXCLUDE 0, ALREADY-A-PATCH-EQUIVALENT 0.** None of the incoming commits reverts existing functionality per subjects + diffs. No incoming commit executes migrations at this stage (only #219/#221/#222 add DB-touching CI harnesses with disposable-DB gating).

## 4. Required focus items

### 4.1 fast-uri (#220) — present on origin/main, absent on HEAD
Fresh `npm ls` on this tree shows `fast-uri@3.1.6` (via ajv → fast-uri, and webpack/sentry chains). #220's patch is a package-lock bump 3.1.6→3.1.8, **not present locally**. The 2026-11-07 npm audit additionally flags fast-uri ranges `<3.1.9` (scheme spoofing, WHATWG host confusion, relative-reference normalization, suffix-colon scheme injection). **Conclusion:** keep #220 in the plan AND bump to ≥3.1.9 during the authorized dependency cycle. Details: `MERGE_HARDEN_SECURITY_REMEDIATION.md`.

### 4.2 Primary-calendar guard (#218) — semantic status check
Fresh object-level inspection (2026-11-07):
- `git show 25ddac2:lib/calendar/googleCalendarGate.ts` → path did not exist at merge-base (file introduced independently on both lineages).
- `git show HEAD:lib/calendar/googleCalendarGate.ts` → contains **no** `primary|alias` rejection string.
- `git show HEAD:lib/server/googleCalendarStoreContract.test.ts` → already asserts `calendar id is never defaulted and never falls back to a primary calendar` (source-level regex `doesNotMatch(/calendar_id[\s\S]*default|\bprimary\b/i)`).

**Reading:** the branch protects the store level and rejects alias-by-absence, but the #218 *gate + configure + store alias-rejection logic* is origin/main-only. The uncommitted working-tree gate rewrite (`googleCalendarGate.ts` +44/−12 vs HEAD: added `isSaneSupabaseUrl`, `GOOGLE_CALENDAR_PRODUCTION_ENABLED` opt-in) does not include #218 either. **This is a genuine convergence point requiring reviewed manual resolution** (not ours/theirs): keep the explicit-ID guard from #218 and keep the branch's production opt-in gate. No auto-resolution.

### 4.3 WhatsApp / booking / approvals / auth surface
Incoming commits touch the WhatsApp outbound finalizer only through CI/SQL *evidence harnesses* (no runtime change) and do not touch webhook ingest, channel assignment, opt-out, or window logic. Booking ledger files arrive as tests+harness. Auth/authz/RLS: not modified by the 8 commits (tests only). Verified by fresh 667/667 pass of the current branch's suites (`MERGE_HARDEN_VERIFICATION.md`).

### 4.4 Anything the counts could have wrongly suggested
Counts alone (18/0, 8/149) were **not** used for direction: local `main` has zero unique commits, so reconciliation need not preserve any main-only commit; incoming work is provider-canonical test/harness/dep/guard material; the feature branch carries the canonical feature work (149 commits, 78-file diffstat). Proposed direction is defined in `MERGE_HARDEN_INTEGRATION_PLAN.md` — planning only.

## 5. Unique work inventory per lineage

| Lineage | Unique valuable content |
|---|---|
| `origin/main` (8 commits) | fast-uri patch; primary-alias guard; staging OAuth/migration truth docs; migration-replay & outbound-finalizer & recovery-bundle CI harnesses; disposable-DB proof suites |
| `codex/appointment-integration-v1` (149 commits, of which 159-from-main perspective) | Full appointment/calendar integration lineage (uncommitted +248/−44 refinements on top), booking ledger proofs, UI/accessibility waves, security hardening (tracked-secret guard, production-build guard, atomic claim), 667-test suite |
| local `main` | **none** (0 unique — behind 18) |

## 6. Deliverable status

Stage B complete: every divergent commit captured with hash, subject, author (`ys7259218-maker` for all 8), files, purpose, security implication, conflict potential, representation check, and disposition. No Git mutation was performed. Authorization gate remains: Stage F **BLOCKED** (See MH-A §4).
