# Phase A — FINAL REPORT (Repository Stabilization, Integrity Audit & Verified Baseline)

**Date:** 2026-11-07 · **Repository:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` (branch `codex/appointment-integration-v1` @ `8c70be6`) · **Phase A status: COMPLETE — with 3 documented owner-decision areas and environmental notes.**

---

## 1. Executive summary

Phase A verified the repository's true state end-to-end without altering any user work, committing, merging, or changing history. The repo is in better structural shape than previously believed once a **non-git root cause** was fixed: an inactive OneDrive client was leaving `.git/refs` and `node_modules/.next-cache` files as unreadable cloud-only placeholders, which had (a) masqueraded as "3–4 broken git refs", and (b) made every `next build` either silently abort or crash inside Turbopack with `os error 389`. After starting OneDrive and re-verifying: `git fsck --full` exit **0**, all refs resolve, **667/667 unit tests pass**, typecheck clean, lint 0 errors/16 pre-existing warnings, all 4 guard scripts pass, and a **genuinely fresh production build** was produced and artifact-verified (`BUILD_ID OfVBkeF8n3m2k39M-fnCm`, exit 0, 512 s). Outstanding: 19 npm-audit findings (owner-decision), the 8-commit origin/main reconcile (owner authorization), and the 12-file uncommitted calendar/OAuth work that must be reviewed→committed by the owner.

## 2. Actual repository identity and branch

- Branch `codex/appointment-integration-v1`, HEAD `8c70be6`, identical to `origin/codex/appointment-integration-v1`. Remote `github.com/ys7259218-maker/nexa.git`. Local `main` = `06679d9` and is **18 commits behind `origin/main`** (previous audit's "18 ahead" was inverted). Merge-base with main: `06679d9`.
- `origin/main` has **8 commits** missing from this branch (listing in `PHASE_A_GIT_INVENTORY.md` §2), incl. dependency patch `#220` (fast-uri 3.1.8) and `#218`'s `primary`-alias guard (already re-implemented in the uncommitted working tree — reconcile must unify).

## 3. Git integrity and working-tree condition

- `git fsck --full --no-dangling` exit **0** after hydration: no missing/corrupt objects. The earlier "broken refs" (`opencode/cycle5-task` head+remote, 2 dependabot remotes) were OneDrive placeholder read-failures ("Invalid argument" + invalid-sha1-zero), NOT repo damage; all four now resolve to real commits (`b9b49387`, `196af757`, `72a5653`).
- Working tree: 12 modified files (+248/−44; calendar OAuth + preflight, described and risk-classed in `PHASE_A_CALENDAR_REVIEW.md`), no staged changes, no stashes; 6 untracked entries; 2 accidental root strays (`page.tsx` almost identical to team page; `route.ts` byte-identical to callback route); 1 registered worktree `.codex-worktrees/pr219-reconcile` (clean); 4 stale "prunable" worktree registrations for Temp directories that no longer exist (branches intact; `git worktree prune` left for owner approval).

## 4. Preserved user changes (nothing was lost or overwritten)

- All 12 modified files kept **as-is** (including cosmetics such as the UTF-8 BOM and missing EOF newline — flagged, not "fixed", since they are the owner's in-flight work).
- Untracked work preserved: `components/calendar/GoogleCalendarConnection.tsx`, `docs/BLUEPRINT_PERCENTAGE.md`, `docs/STAGING_OAUTH_CONSENT_RUNBOOK.md`, `.codex-worktrees/`, and the two root strays (deliberately **not deleted**).
- The pre-rebuild `.next` artifacts were **preserved, not deleted**: moved intact to `Temp\opencode\phase-a\frozen-next-20261107` (documented; owner may delete later).

## 5. Calendar integration review

See `PHASE_A_CALENDAR_REVIEW.md`: staging-first OAuth flow (PKCE S256, constant-time state compare, cookie-based verifier/state single-use, AES-256-GCM token envelope, service-role-only writes, sanitized actor reads, `primary`-alias rejection); imports resolve (typecheck); routes correctly placed; `GOOGLE_CALENDAR_PRODUCTION_ENABLED` double-gate (explicit flag + non-staging URL) with new tests. Open hardening suggestions: exact-scope assertion post-exchange; `__Host-` cookie prefixes; stored-scope byte-exactness UI cross-check. Blockers: owner consent visit, callback host registration, token-key escrow drill.

## 6. Dependency and security findings

`npm audit`: **19 findings — 2 critical (`next` 16.3.4 bundle; `@sentry/nextjs` 10.74.0), 5 high (zod 4.4.3, sharp 0.35.4, source-map-js, fast-uri, brace-expansion), 12 moderate** — full table + reachability classification in `PHASE_A_SECURITY_AUDIT.md`. App-code reachability: `next/og`, `"use cache"`, Draft Mode, and the Sentry tunnel route are not used (several criticals not applicable as-written); Server-Action DoS and image-optimization surface ARE applicable; Sentry is dormant (disabled DSN). Tracked-secrets guard passes. **No lockfile mutation, no upgrades** — an owner-approved upgrade plan (order: reconcile→#220 first, then next/sentry/zod/sharp minors) is documented.

## 7. Typecheck, lint and test results (all fresh, exit-coded)

| Check | Exit | Result |
| --- | --- | --- |
| `npm run typecheck -- --incremental false` | 0 | 0 errors |
| `npm run lint` | 0 | **0 errors / 16 warnings** (pre-existing; incl. user's worktree copies) |
| `npm test` | 0 | **667/667 pass** |
| `npm run check:documented-count` | 0 | 667 matches |
| `npm run check:tracked-secrets` | 0 | pass |
| `npm run check:production-build` | 0 | pass (no values printed) |
| `npm run test:issue-reports` | 0 | 5/5 |

(Transparent note: one intermediate lint run reported 109 errors because the preserved frozen `.next` copy temporarily lived inside the repo; after relocating it, lint returned to baseline. Logged in `PHASE_A_VERIFICATION_REPORT.md` §3.)

## 8. Fresh production build result — **PASS**

`next` **16.3.4** (Turbopack): start 2026-11-07T10:58:05Z → end 11:06:38Z, **exit 0, 512 s**, complete route table (40/40 pages), all manifests + `BUILD_ID OfVBkeF8n3m2k39M-fnCm` freshly timestamped. Root strays produce no routes. Two earlier inconclusive runs were diagnosed to the OneDrive placeholder cause (documented evidence chain), not to code.

## 9. WhatsApp regression protection

All pipeline protections intact and test-pinned (signature verify, ledger dedupe/retry, channel assignment, kill-switch/takeover/opt-out, approval claim, 24h window, bounded failure facts, `WHATSAPP_OUTBOUND_ENABLED` flag discipline incl. production-guard interlock). **No message sent, no Meta config change, no credentials touched.** See `PHASE_A_WHATSAPP_PROTECTION.md` for executed vs not-executed tests (integration/hosted suites remain BLOCKED on credentials).

## 10. Architecture baseline

`PHASE_A_ARCHITECTURE_BASELINE.md` maps every DEXYBOR-vision capability honestly: tenancy/RLS, WhatsApp pipeline, knowledge v0, lifecycle/sandbox, audit, calendar OAuth = implemented+verified; OpenAI provider, staging booking adapter, calendar end-to-end = implemented-unverified; agent engine, durable approval-task runtime, tool registry, browser/computer-use, long-term memory, orchestration, inference ownership = **not present in this repo** (D7 docs describe only a future validation plan; those docs are out-of-repo snapshot lineage).

## 11. Owner decisions and blockers

23 D7 decisions remain OPEN with the preserved statuses (D7 0/10 NO-GO, baseline NOT ESTABLISHED, Phase 5 BLOCKED, release NO-GO) — full table + risks in `PHASE_A_OWNER_BLOCKERS.md`. External blockers: calendar consent, Meta WABA/real-send approval, OpenAI paid key, staging/prod credentials revocation-rotation policy, disposable-DB authorization (OD-02). Note: D7 evidence chain relies on verbatim-recovered out-of-repo documents; a fresh signed OD-01 record is still the single root authorization.

## 12. Changes made in Phase A (exact list)

1. **Created** (new files only): `docs/PHASE_A_GIT_INVENTORY.md`, `docs/PHASE_A_CALENDAR_REVIEW.md`, `docs/PHASE_A_SECURITY_AUDIT.md`, `docs/PHASE_A_VERIFICATION_REPORT.md`, `docs/PHASE_A_WHATSAPP_PROTECTION.md`, `docs/PHASE_A_ARCHITECTURE_BASELINE.md`, `docs/PHASE_A_OWNER_BLOCKERS.md`, `docs/PHASE_A_FINAL_REPORT.md`.
2. **Environment-only remediation:** started the local OneDrive client (restores placeholder hydration); no repo file altered by it.
3. **Build-output preservation/regeneration:** `.next` (obtained + renewed) — frozen copy retained outside repo at `Temp\opencode\phase-a\frozen-next-20261107`; fresh `.next` is the current build output. Nothing tracked changed.

## 13. Changes deliberately NOT made

No commits/pushes/merges/rebases/resets; no branch or ref writes; no `worktree prune`; no deletion of untracked files or the user worktree; no lockfile change, no `npm audit fix`, no dependency upgrade; no migration application; no OAuth consent/Meta/OpenAI/hosted-DB action; no D7 docs applied (conflict-correction stays PROPOSED — NOT APPLIED); no renames (project stays "nexa"; DEXYBOR branding remains a separate future task); no `.env.local` value reads.

## 14. Remaining risks

1. **OneDrive fragility of `.git/.next/node_modules`** (repeatable environment-level failure mode) — mitigation documented.
2. **12-file uncommitted work unmerged** (calendar/preflight) + root strays — owner review then commit.
3. **8 missing origin/main commits** (incl. security patch) — reconcile required before release-related claims.
4. **19 npm-audit findings** (2 critical) — upgrade next/sentry (and fast-uri via #220) under owner approval.
5. **4 stale worktree registrations** — cosmetic.
6. D7/document-set provenance: controlling D7 docs live only as recovered session copies — owner should decide their canonical home (e.g., restore into a repo-controlled store) before any D7 execution.

## 15. Phase A acceptance matrix

| Area | Criterion | Status |
| --- | --- | --- |
| Git integrity | refs/worktrees/fsck inventoried | ✅ DONE (fsck 0) |
| User changes | preserved | ✅ DONE |
| Branch safety | divergence mapped; no unauthorized merge | ✅ DONE |
| Calendar work | reviewed (code-level) | ✅ DONE |
| Security | actual advisories classified | ✅ DONE |
| Typecheck | verified | ✅ (exit 0) |
| Lint | verified | ✅ (0 errors/16 warnings) |
| Unit tests | verified | ✅ (667/667) |
| Security checks | tracked-secret verified | ✅ |
| Fresh production build | verified | ✅ **PASS** |
| WhatsApp protection | preserved + test-armed | ✅ |
| Architecture | accurately classified | ✅ |
| Owner decisions | documented, none made | ✅ |
| Release readiness | explicit verdict with evidence | ✅ — **NO-GO** |

**Phase A: COMPLETE** (no criterion left unverified; the blocked checks are owner/environment-gated by design and documented as such).

## 16. Final GO / NO-GO recommendation

**NO-GO for production release.** Required to move toward GO, in order: (1) owner sign OD-01 record (single root authorization), (2) commit/reconcile uncommitted work with `origin/main` (8 commits incl. fast-uri patch), (3) owner-approved dependency upgrade cycle for the 2 criticals (+5 highs), (4) calendar consent + Meta WABA + outbound test only with explicit owner approval, (5) disposable-DB validation executed per D7 with an authorized target (OD-02) and fresh evidence, (6) Phase 5 acceptance evidence before any "ready" claim.

## 17. Recommended next phase

**Phase B candidate: "Merge & Harden" — not the Agent Engine yet.** One owner-authorized batch: clean strays ✓ (approval), fast-forward `main`, unify calendar gate code (#218 equivalence), upgrade the critical/high deps, re-run full verification + fresh build; only after a clean reconcile would the DEXYBOR Agent Engine bring-in start on top of a trustworthy baseline. (Agent Engine implementation itself remains unstarted by design in Phase A.)
