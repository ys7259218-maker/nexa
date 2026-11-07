# DEXYBOR AI — MERGE & HARDEN: FINAL REPORT

**Report ID:** MH-J · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` — DEXYBOR AI (legacy: Nexa)

---

## Per-master-prompt §14 statement

**Status: MERGE & HARDEN — AUTHORIZATION BLOCKED** (mutation execution: NOT performed; investigation & verification: COMPLETE)

**Authorization:** Exact approved scope = read-only investigation ×9 required reports + safe local tests + fresh local build. Everything mutating (commit, merge, branch-create, push, dependency changes, worktree prune, stray-file deletion, migrations, deploy, WhatsApp/Meta/Google/Vercel/Supabase actions, env changes) = **NOT APPROVED** (table: `MERGE_HARDEN_AUTHORIZATION_REVIEW.md`). OD-01 remains a placeholder for the accountable owner: signed approval **absent**; fresh search found no new owner record.

**Git baseline:** branch `codex/appointment-integration-v1` @ `8c70be6eeb8d5dbabbbdcff515b8d55f67e69961` (in sync with origin) · local `main` @ `06679d9dbd169bb7f8204947250f197b9cee127d` · `origin/main` @ `3c10dca9b369fb1b1fe8ba847c6b40075091763e` · merge-bases: `main↔origin/main` = `06679d9`, `HEAD↔origin/main` = `25ddac2`.

**Divergence:** origin/main-only = **8** commits; HEAD-branch-only = **149** (159 when measured against local `main`); local `main` unique = **0**.

**Commit review:** INCLUDE (proposed) = 7 · OWNER REVIEW REQUIRED = 1 (`c2b2120`/PR #215) · EXCLUDE = 0 · ALREADY-PATCH-INTEGRATED = 0 (cherry empty). Security-bearing incoming: #218 primary-alias guard, #220 fast-uri patch, #219/#221/#222 DB-related CI/harness code (execution-gated). (Full detail: `MERGE_HARDEN_GIT_DIVERGENCE.md`.)

**Preservation:** **INTACT.** 12 modified tracked (+248/−44) and 14 untracked files unchanged through the entire session; SHA-256 manifest recorded; `git status` pre/post identical; root strays `page.tsx`/`route.ts` analyzed as inert duplicates (one identical to calendar callback route by SHA-256; the near-duplicate differs only by one JSX whitespace line) and **not deleted**. (`MERGE_HARDEN_WORK_PRESERVATION.md`.)

**Integration:** **NOT performed** — blocked at the authorization boundary. Proposed strategy documented and ready (`MERGE_HARDEN_INTEGRATION_PLAN.md`): integration branch from `8c70be6` → commit preserved work → `merge origin/main` → intent-preserving conflict resolution (calendar gate/store/configure, GO_LIVE/HANDOFF docs, lockfile) → verify → PR.

**Security:** fresh `npm audit` = **2 critical / 5 high / 12 moderate (19)** before = after (no dep changes applied). Critical surfaces: next 16.3.4 (effective fix floor **16.4.1** — Server-Actions DoS & Image-Opt RCE fixes land there; app's `next/og`,`use cache`, draftMode, Sentry-tunnel surfaces verified UNUSED; Server-Actions surface applicable), @sentry/nextjs 10.74.0 → **10.78.0** (dormant: no tunnel, DSN unset). Highs: fast-uri → ≥**3.1.9** (#220's 3.1.8 superseded by later advisories), sharp → ≥0.35.5, source-map-js → ≥1.2.2, brace-expansion → ≥1.1.21/≥5.0.12, zod → ≥4.6.6 dev-chain-only (first-party zod imports: zero). `npm audit fix [--force]` never executed. (`MERGE_HARDEN_SECURITY_REMEDIATION.md`.)

**Tests:** typecheck PASS (0) · lint PASS (0 errors, 16 non-blocking warnings — same 16 in tracked tree + mirror copies) · `npm test` **667/667 PASS** · `test:issue-reports` **5/5 PASS** · guards **3/3 PASS** (tracked-secrets, documented-count=667, production-build) · `git fsck --full` exit 0 (dangling-only).

**Build:** fresh production build **PASS** — BUILD_ID **`YlYbA_DahfD0FyTlwunD_`**, compiled 13.4 s, **40/40** static pages, wall ~58 s (Turbopack cache reuse of Phase A's verified baseline — disclosed, not hidden), zero warnings/errors, BUILD_ID file written 16:59:30 2026-11-07, OneDrive client verified running (no hydro-placeholder incidents).

**WhatsApp:** **protected** — outbound stays disabled (`WHATSAPP_OUTBOUND_ENABLED=false` everywhere incl. preflight invariant tests); webhook signature, ledger dedupe, channel assignment, opt-out, takeover, 24-hour window, atomic claim, retry/receipts all fresh-PASS; no Meta calls/config changes; staging/DB-dependent proofs classified BLOCKED (OD-02). (`MERGE_HARDEN_WHATSAPP_REGRESSION.md`.)

**Calendar:** OAuth routes guarded (staging-only gate mirror + production opt-in in uncommitted work), explicit calendar id/no-primary-fallback contract fresh-PASS, server-only token store intact; conflicts with incoming #218 resolved *on paper* in the integration plan; no live OAuth performed.

**Files changed (this op):** ONLY 9 new reports created in `docs/`:
`MERGE_HARDEN_AUTHORIZATION_REVIEW.md`, `MERGE_HARDEN_GIT_DIVERGENCE.md`, `MERGE_HARDEN_WORK_PRESERVATION.md`, `MERGE_HARDEN_INTEGRATION_PLAN.md`, `MERGE_HARDEN_SECURITY_REMEDIATION.md`, `MERGE_HARDEN_WHATSAPP_REGRESSION.md`, `MERGE_HARDEN_VERIFICATION.md`, `MERGE_HARDEN_ARCHITECTURE_REVIEW.md`, `MERGE_HARDEN_FINAL_REPORT.md` — plus throwaway logs/hash artifacts outside the repo (`Temp\opencode\mh-*`). **No tracked source file, no config, no lockfile touched.**

**Git history:** **no commits, no merges, no pushes, no resets, no rewrites, no branch/worktree changes, no ref updates.** History identical at start and end.

**Outstanding decisions:** OD-01 … OD-23 all **OPEN** (unchanged, correct — no evidence invented). External owner-gated prerequisites remain: OD-01 signing, OD-02 disposable-DB authorization, calendar consent, Meta WABA/registration + real-send approval, OpenAI paid key, credential rotation policy.

**Production release: NO-GO.** PASS of local verification does not lift the release gates: no integration happened, 2 critical vulnerabilities unpatched, no owner release decision, no production deployment evidence.

**Next recommendation (evidence-based, in order):**
1. Owner signs OD-01 + grants the exact Stage F scope list (preservation copy; integration branch; commit list; merge; fast-uri≥3.1.9; push/PR mode; conflict-review duty).
2. Execute Stage F strictly per `MERGE_HARDEN_INTEGRATION_PLAN.md` (S1) with intent-preserving conflict resolution; document each conflict.
3. Run the authorized dependency cycle (next ≥16.4.1, @sentry/nextjs 10.78.0 + transitive floors) with before/after audit capture.
4. Re-run the full verification matrix + fresh build on the integrated state; then owner decides release gates (still NO-GO until then).

## Acceptance-gate cross-check (§12)

| Gate | Result |
|---|---|
| Authorization verified (exact scope) | Verified, but **absent for mutations** → block |
| Git divergence classified | ✅ all 8+149+0 classified |
| Preservation intact | ✅ manifest + pre/post hash match |
| Integration executed | ✗ BLOCKED |
| Conflicts resolved | ✗ none executed (forecast + policy documented) |
| Security remediation | ✗ 2C/5H unpatched (proposals ready) |
| Typecheck / Lint / Tests / Build / WhatsApp / Calendar | ✅ fresh PASS (local) |
| DB / Git history / Production | ✅ zero unauthorized activity |

→ Overall: **AUTHORIZATION BLOCKED** (not COMPLETE, not PARTIALLY COMPLETE by §12's own rule — every *executable* investigation gate passed; only owner-gated mutation gates remain closed).
