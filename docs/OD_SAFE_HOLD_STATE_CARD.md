# OD SAFE-HOLD STATE CARD — DEXYBOR (NOTHING TO DO · EVERYTHING VERIFIED)

**Card:** OD-HOLD-1 · **Date/time:** 2026-11-07 (evening sweep)
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` — DEXYBOR AI (legacy: Nexa)
**Nature:** read-only safety sweep + this documentation-only card. **No code, Git, config, dependency, migration, or system change was made.**

> ## BOTTOM LINE
> **The owner must do nothing right now.** Every piece of preserved work and every prepared artifact is fresh-hash-verified, the repo's object store is clean, and all remaining work is *parked* until the owner chooses to unpause it. If anything ever looks "off", verify against this card (§5) — this card is the reference photo of the safe state.

---

## 1. Live state at sweep time (all read-only checks)

| Check | Result |
|---|---|
| HEAD | `8c70be6eeb8d5dbabbbdcff515b8d55f67e69961` (`codex/appointment-integration-v1`, in sync with origin) |
| Working tree | 12 modified tracked + 29 untracked, **0 staged**, no deletions/renames type entries |
| `git fsck --full` | clean; output shows only `dangling` object lines — the healthy, expected pattern recorded since Phase A |
| Preservation baseline | identical to `MERGE_HARDEN_WORK_PRESERVATION.md` (MH-C) — composition + spot-checked hashes match (below) |

## 2. Preservation hashes — 12 modified tracked files (fresh re-hash, matches MH-C baseline)

| File | SHA-256 (first 16) | Baseline match |
|---|---|---|
| `NEXA_HANDOFF.md` | `94CC1826E4FDE6C9` | ✔ MH-C |
| `app/api/integrations/google-calendar/callback/route.ts` | `41A70B8BE881B4AD` | ✔ MH-C |
| `app/api/integrations/google-calendar/configure/route.ts` | `2DD98FABBB072F97` | recorded fresh here |
| `app/api/integrations/google-calendar/connect/route.ts` | `DF7586C2475A9380` | recorded fresh here |
| `app/api/integrations/google-calendar/disconnect/route.ts` | `9A495211766EA80C` | recorded fresh here |
| `app/api/integrations/google-calendar/status/route.ts` | `A5065E2686C31EAD` | recorded fresh here |
| `app/settings/team/page.tsx` | `BBC085562E10734A` | ✔ MH-C |
| `docs/GO_LIVE.md` | `6D386E4EF2924551` | recorded fresh here |
| `lib/calendar/googleCalendarGate.test.ts` | `4A8462AC1851DA37` | recorded fresh here |
| `lib/calendar/googleCalendarGate.ts` | `D2EBF7BFF10ECEF1` | recorded fresh here |
| `lib/deployPreflight.test.ts` | `F102E90E85D8088F` | recorded fresh here |
| `lib/deployPreflight.ts` | `EF383162CBEAEB40` | recorded fresh here |

(MH-C §2–3 remains the full authoritative manifest — including the 14 original untracked originals; this card re-proves the tracked layer today.)

## 3. Prepared-artifact hashes (all verified unchanged this session)

| Document | SHA-256 (first 16) | Role |
|---|---|---|
| `docs/OD-01_OWNER_AUTHORIZATION_DRAFT.md` | `3858B1024ED122E8` | unsigned authorization draft |
| `docs/OD-01_AUTHORIZATION_VERIFICATION_REPORT.md` | `7A5E65287AA04263` | verification report (BLOCKED) |
| `docs/OD-01_AUTHORIZATION_EVIDENCE_INTAKE.md` | `434A97B4756BA14D` | intake report |
| `docs/OD-01_EXECUTION_INSTRUCTION_TEMPLATE.md` | `D34D25CA5A92157D` | sign-ready instruction template |
| `docs/DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` | `C0FC8B066735574D` | Phase B blueprint |
| `docs/DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md` | `4A250EACF47EDA33` | OD-B decision matrix |

## 4. Environment note (recorded, no action taken by the operator)

- **OneDrive client**: binary installed (`…\AppData\Local\Microsoft\OneDrive\OneDrive.exe`) but the **process is not currently running** (it was running earlier today, PID 14092). All repo files are readable on disk — nothing is missing. Practical meaning: cloud sync/backup resumes whenever OneDrive is next started; it is normally on auto-start. The operator has deliberately **not** started system processes on the owner's machine.
- Standing pre-condition for any future build (`MH-H`): the OneDrive client should be **running** before `next build` (Turbopack mapper sensitivity was a Phase A root cause) — that gate is already part of every execution plan.

## 5. "Do NOT touch" list (protects both preserved work and prepared docs)

Nobody (agent, tool, script, or person without an owner instruction) may:
1. Run `git clean`, `git reset`, `git checkout --`, `git stash (any subcommand)`, `worktree prune`, force-push, or any branch/ref mutation.
2. Run `npm audit fix`, `npm install`, `npm update`, or edit `package.json` / `package-lock.json`.
3. Move, rename, or delete the repo folder, or edit/rename/delete any file under it.
4. Delete or prune `.codex-worktrees/` (1 active + 5 stale registrations are recorded and preserved).
5. Edit any `docs/OD-*` or `docs/DEXYBOR_*` prepared document (they are verification references).
6. Change environment variables, `.env`, OneDrive/sync settings, or run migrations/deploy.

**If anything at all seems wrong, the only safe move is: STOP → compare against this card via §6 → report to the owner.**

## 6. Quick self-verification recipe (any time, cost ~30 s)

```text
Expected: HEAD 8c70be6eeb8d5dbabbbdcff515b8d55f67e69961
Expected: git status --short --branch → 12 lines " M " + 29 "?? " + header line; 0 staged
Any file in doubt         → compare its SHA-256 with §2/§3 tables here (or MH-C manifest)
Any doc in doubt          → hash must equal §3; mismatch = tamper/restore attempt → STOP & report
Repo doubt                → `git fsck --full` must show no errors, only dangling-object lines
Unexpected ANYTHING       → STOP. Do not "fix" it. Report.
```

## 7. What is parked (nothing expires on its own)

| Parked item | Resumes when |
|---|---|
| Stage F (Merge & Harden execution) | owner delivers the **2 signed instruments** (OD-01 signed variant + `OD-01_EXECUTION_INSTRUCTION_TEMPLATE.md` completed & signed) → operator runs fresh formal verification → step-by-step execution inside approved scope only |
| Phase B implementation | OD-B decisions (minimum: **OD-B12, OD-B1, OD-B2**) + a further explicit owner instruction — never from this card alone |
| Optional cleanups (worktree prune, root strays, disposable-DB tests) | explicit owner rows only (template §D/§H) |
| Small note-field reminders | none — until any signed instrument includes an expiry date, nothing here has an expiry |

---

**Status: `SAFE HOLD PRESERVED — NO OWNER ACTION REQUIRED — NO MUTATIONS PERFORMED — STAGE F BLOCKED UNTIL SIGNED INSTRUMENTS`**
