# OD-01 STAGE F RE-BASELINE ANALYSIS (READ-ONLY — NO MUTATION)

**Report:** OD01-RB-1 · **Date:** 2026-11-08 (PKT, after midnight)
**Trigger:** signed Stage F pre-flight found live `origin/main` = `3279ac2…`, not the signed `3c10dca…`.
**Nature:** read-only. `git ls-remote` + GitHub compare API + local `git diff` against fetched file contents. **No fetch, no branch, no commit, no merge, no dependency change.** Working tree untouched except the two signed-instrument copies.

---

## 1. Signed vs live (2026-11-08)

| Item | Signed Stage F | Live remote |
|---|---|---|
| `origin/main` | `3c10dca9b369fb1b1fe8ba847c6b40075091763e` | `3279ac2cfd7386ab5adef35b37f43382772c2aaa` |
| commits ahead of pinned | — | **45** |
| behind pinned | — | 0 (`3c10dca` is an ancestor) |
| local `origin/main` ref | `3c10dca` (last fetch 2026-09-30) | stale — never saw the 45 commits |

The signed execution instruction step 4 and authorization R1/R4 pin `3c10dca` (7 commits). Merging the live `3279ac2` would add 45 commits not in the signed list; merging only `3c10dca` would leave the PR 45 commits behind `main`. Per signed R12 + the instruction's stop conditions (unexpected repo state / scope conflict) the run stopped before any mutation.

## 2. The 45-commit delta (GitHub compare, 40 files)

Categories: Google Calendar production enablement + team rollout · WhatsApp inbound/outbound recovery code · OpenAI + OpenAI-compatible provider · public landing page + privacy · one migration **file** (not executed) · staging-overlay script · docs/handoff updates · `.env.example` provider documentation.

No secrets in the delta (`.env.example` only); no `package-lock.json` change; no dependency version change.

## 3. Overlap with the preserved working tree (12 modified files)

Fresh byte comparison against `3279ac2`:

| File | Local vs `3279ac2` | Meaning |
|---|---|---|
| `app/api/integrations/google-calendar/callback/route.ts` | **identical** | already on main |
| `app/api/integrations/google-calendar/configure/route.ts` | **identical** | already on main |
| `app/api/integrations/google-calendar/connect/route.ts` | **identical** | already on main |
| `app/api/integrations/google-calendar/disconnect/route.ts` | **identical** | already on main |
| `app/api/integrations/google-calendar/status/route.ts` | **identical** | already on main |
| `app/settings/team/page.tsx` | **identical** | already on main |
| `lib/calendar/googleCalendarGate.ts` | **identical** | already on main |
| `lib/calendar/googleCalendarGate.test.ts` | **identical** | already on main |
| `lib/deployPreflight.ts` | differs (+84/−3 vs main) | local is an **older** iteration; main supersedes |
| `lib/deployPreflight.test.ts` | differs (+109/−0 vs main) | local is an **older** iteration; main supersedes |
| `NEXA_HANDOFF.md` | differs (+50/−6 vs main) | local is **older**; main has Oct 6–8 entries |
| `docs/GO_LIVE.md` | differs (+40/−9 vs main) | local is **older**; main supersedes |

Untracked overlaps:

| File | Local vs `3279ac2` | Meaning |
|---|---|---|
| `components/calendar/GoogleCalendarConnection.tsx` | **identical** | already on main |
| `docs/BLUEPRINT_PERCENTAGE.md` | differs (local 3,146 B vs main 3,134 B) | local is an **older draft**; main's newer version wins; original preserved in backup |

**Conclusion:** 8/12 modified files are byte-identical to main; the remaining 4 are older subsets superseded by main. No unique local code work is lost. The only unique local artifacts are the new planning docs (MH/OD/DEXYBOR series), which are not on main.

## 4. Dependency state (unchanged by re-baseline)

`package.json` at `3279ac2`: `next ^16.3.2`, `@sentry/nextjs 10.74.0` — the MH-E floors (next ≥16.4.1, sentry 10.78.0, sharp ≥0.35.5, source-map-js ≥1.2.2, brace-expansion ≥1.1.21/≥5.0.12, fast-uri ≥3.1.9, zod ≥4.6.6) still apply exactly as signed. The 45 commits add no dependency changes and no lockfile change.

## 5. Proposed resolution rule (intent-preserving)

For the four older-duplicate files and the older `BLUEPRINT_PERCENTAGE.md` draft, the merge takes **main's newer content**; this discards no unique work because the local content is an older subset already contained in main. The pre-merge preservation copy + commit retains every original byte-for-byte. No blind `-X ours/theirs`; each resolution is documented. New planning docs are preserved and committed.

---

**Status: `READ-ONLY RE-BASELINE ANALYSIS COMPLETE — NO MUTATION — AMENDMENT REQUIRED — STAGE F STILL STOPPED`**
