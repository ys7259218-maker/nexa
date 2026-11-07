# OD-01 STAGE F RE-BASELINE AMENDMENT — FOR OWNER SIGNATURE

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S — the operator cannot fill these
> This one-page amendment modifies **exactly two pins** in the already-signed Stage F pack:
> 1. `docs/OD01_MINI_AUTHORIZATION_SIGNED.md` (SHA-256 `0FE855A7…`) — rows R1/R4: merge source `origin/main` @ `3c10dca` → **`3279ac2`**.
> 2. `docs/OD01_MINI_EXECUTION_INSTRUCTION_SIGNED.md` (SHA-256 `B5B99703…`) — step 4: same merge-source change.
> **All other terms remain exactly as signed** (R2, R3, R5–R12; execution steps 1–3 and 5–8; exclusions; validity rules). Nothing else changes.

**Date of this amendment:** 2026-11-08 · **Reason:** live `origin/main` moved from `3c10dca` to `3279ac2` (45 commits ahead) after the signed pack was prepared; the pack's own stop condition requires fresh approval.

---

## 1. What changes (only this)

| Item | Signed value | Amended value |
|---|---|---|
| Merge source | `origin/main` @ `3c10dca` (7 commits) | `origin/main` @ **`3279ac2cfd7386ab5adef35b37f43382772c2aaa`** (45 commits since `3c10dca`) |
| Commit coverage | 7 INCLUDE rows + `c2b2120` DEFER | Same 7 rows + the 45 newer commits already on `origin/main`; **`c2b2120` remains DEFER** |
| Everything else | — | Unchanged |

## 2. Read-only analysis (what the 45 commits mean)

- **8 of the 12 locally modified files are byte-identical to `3279ac2`** — all Google Calendar routes, gate, tests, callback, team page. Local content = main content → no conflict.
- `lib/deployPreflight.ts`, `lib/deployPreflight.test.ts`, `NEXA_HANDOFF.md`, `docs/GO_LIVE.md`: local is an **older version** of what main already contains in newer form → main's newer content wins; originals preserved in the backup.
- `docs/BLUEPRINT_PERCENTAGE.md` (untracked): local is an older draft; main's newer version wins; original preserved.
- `components/calendar/GoogleCalendarConnection.tsx` (untracked): byte-identical to main → no conflict.
- New local planning docs (MH/OD/DEXYBOR series) are not on main → preserved and committed.
- The 45 commits include production Google Calendar enablement, team rollout, WhatsApp/outbound code, `.env.example` documentation, and one migration **file** (not executed). No secrets in the delta; no dependency or lockfile change.

## 3. Resolution rule for overlapping files (intent-preserving)

For the four older-duplicate files and the older `BLUEPRINT_PERCENTAGE.md` draft, the merge resolution takes **main's newer content**; no unique work is discarded because the local content is an older subset already contained in main. The pre-merge preservation copy + commit retains the originals byte-for-byte. No blind `-X ours/theirs`; each resolution is documented.

## 4. Exception box

```text
EXCEPTED ITEMS (blank = none): ______________________________
Details: ____________________________________________________
```

## 5. Binding tick

```text
 [x]  I APPROVE this re-baseline amendment exactly as written; the two signed Stage F instruments are amended only as described in §1, all other terms unchanged.
```

## S. Owner signature (owner must type these fields personally — operator will not)

```text
Full legal name (typed): yuvraj singh
Authority basis: Repository owner
Signature (type full name again): yuvraj singh
Date & time typed: 08/11/2026 — 00:10 — Timezone: PKT
*Operator intake rule: blank or non-owner-filled fields ⇒ instrument VOID ⇒ Stage F stays stopped.*

**Status: `RE-BASELINE AMENDMENT PREPARED — AWAITING OWNER SIGNATURE — STAGE F STILL STOPPED`**
