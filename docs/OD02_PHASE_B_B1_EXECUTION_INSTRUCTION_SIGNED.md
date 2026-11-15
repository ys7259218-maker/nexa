# OD-02 PHASE B — MILESTONE B1 EXECUTION INSTRUCTION — FOR OWNER SIGNATURE

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S — the operator cannot fill these
> This is the separate, owner-issued execution instruction required for **Phase B milestone B1 (Agent Runtime Foundation)**. It authorizes **B1 only**. B2–B9 each require their own later instruction. A chat message, verbal statement, or agent-prepared text is **not** authorization; only this signed file is.
>
> **Precondition:** Stage F PR **#230** must be merged to `main` first. If it is not merged, the operator stops and waits — no Phase B branch is created.

**Date of this edition:** 2026-11-08 · **Companion instruments:** `OD01_MINI_AUTHORIZATION_SIGNED.md` (`0FE855A7…`), `OD01_MINI_EXECUTION_INSTRUCTION_SIGNED.md` (`B5B99703…`), `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B1), `OD_B_P0_QUICK_FILL.md`.

---

## 1. Adopted Phase B defaults (already recorded in the signed mini authorization)

| Decision | Adopted value |
|---|---|
| **OD-B12** | Phase B after Stage F reconciliation — sequenced, never parallel to Stage F |
| **OD-B1** | Zero-new-dependencies typed contracts + one small internal validator util |
| **OD-B2** | No embeddings now; lexical retrieval first; schema stays vector-ready |

## 2. Authorized operation sequence (the ONLY allowed actions, in this order)

| Step | Operation | Boundaries |
|---|---|---|
| 1 | **Pre-flight** | Verify PR #230 is merged; record the resulting `main` SHA; confirm clean tree; create branch `codex/phase-b-b1-agent-runtime` from that SHA; **no new worktree**; no edits to existing branches |
| 2 | **Read-only baseline + design note** | Inspect existing runtime/RLS/feature-flag/test patterns; write `docs/PHASE_B_B1_DESIGN_NOTE.md`; **no code changes** |
| 3 | **Additive migration files** | Agent sessions/tasks/events/leases + RLS/grants; append-only dated migration(s); **files only**; no staging or production execution |
| 4 | **Runtime foundation** | FSM, session/task persistence, lease/claim RPC, cooperative cancel, timeout/watchdog, **mock-executed steps only**; feature flag `AGENT_RUNTIME_ENABLED` default **`false`** |
| 5 | **Events + read-only console** | SSE events skeleton; read-only list/status console; **no mutation actions in the UI** |
| 6 | **Tests** | FSM offline transitions; crash recovery resumes at last step; deadline produces `FAILED`-with-evidence; per-workspace cap; RLS cross-tenant fixtures; agent-role grant matrix; kill-switch drill; cancel-race tests; **no new dependencies** |
| 7 | **Verification** | `npm run check` + fresh production build; any red ⇒ **STOP + report + wait** |
| 8 | **Evidence + PR** | Commit the evidence report **before** PR creation; create PR `codex/phase-b-b1-agent-runtime` → `main`, title `DEXYBOR Phase B B1 — agent runtime foundation`; **owner merges**; operator does not merge/modify/close |

## 3. Boundaries and exclusions (non-waivable)

- **B1 only.** B2–B9 are not authorized by this instruction.
- **No new dependencies** (OD-B1). If one appears necessary, STOP and request a separate dependency decision.
- **No embeddings / pgvector** (OD-B2).
- **No production access, no deploy, no production migrations.** Migration files only; local/CI disposable replay only through the existing harness; no staging DB writes.
- **No live OAuth, no external network calls, no model-provider calls.** B1 steps are mock-executed only.
- **WhatsApp outbound stays `false`.** No agent→WhatsApp send pathway (OD-B11 remains closed).
- **Do not modify** existing appointment, WhatsApp, calendar, outbound, auth, or RLS gates. Additive only.
- **No browser / computer-use** (B7).
- **Flags default off.** Kill-switch must leave the engine dormant; rollback = flags off + additive tables.
- **No direct push to `main`; no force-push; no history rewrite; no guard weakening.**
- **One mutation stream at a time.** No parallel Phase B milestones.
- Root strays `page.tsx`, `route.ts` and `.codex-worktrees/` remain untouched.

## 4. Stop conditions, validity, revocation

- Immediate STOP: verification failure · PR #230 not merged · `main` moved since pre-flight · unexpected repo state · scope conflict · expiry · any need for a new dependency or real-database access.
- Validity: **14 days** from the owner signature date. Any HEAD/`main` change or failed gate ⇒ fresh approval.
- Owner may revoke in writing at any time; revocation is effective immediately.

## 5. Binding tick

```text
[x]   I AUTHORIZE the operator to execute Phase B milestone B1 exactly as written above.
```

## 6. Exception box

```text
EXCEPTED ITEMS (blank = none): ______________________________
Details: ____________________________________________________
```

## S. Owner signature (owner must type these fields personally — operator will not)

```text
Full legal name (typed): yuvraj singh
Authority basis: Repository owner
Signature (type full name again): yuvraj singh
Date & time typed: 08/11/2026 - 00:39 - Timezone: PKT
*Operator intake rule: blank or non-owner-filled fields ⇒ instrument VOID ⇒ Phase B stays stopped.*

**Status: `PHASE B B1 INSTRUCTION PREPARED — AWAITING OWNER SIGNATURE — NOTHING EXECUTED`**
