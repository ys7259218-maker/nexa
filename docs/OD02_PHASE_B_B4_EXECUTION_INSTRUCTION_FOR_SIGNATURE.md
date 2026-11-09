# OD-02 PHASE B — MILESTONE B4 EXECUTION INSTRUCTION — FOR OWNER SIGNATURE

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S — the operator cannot fill these
> This is the separate, owner-issued execution instruction required for **Phase B milestone B4 (Planning & Orchestration)**. It authorizes **B4 only**. B5–B9 each require their own later instruction. A chat message, verbal statement, or agent-prepared text is **not** authorization; only this signed file is.
>
> **Precondition:** B3 PR **#234** must be merged to `main` first. If it is not merged, the operator stops and waits — no B4 branch is created.

**Date of this edition:** 2026-11-09 · **Companion instruments:** signed B3 instruction `OD02_PHASE_B_B3_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md` (`799C02A2…`), signed B2 instruction `OD02_PHASE_B_B2_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md` (`9C942B62…`), signed B1 instruction `OD02_PHASE_B_B1_EXECUTION_INSTRUCTION_SIGNED.md` (`E49CDEC6…`), `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B4), `OD_B_P0_QUICK_FILL.md`.

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
| 1 | **Pre-flight** | Verify PR #234 is merged; record the resulting `main` SHA; confirm clean tree; create branch `codex/phase-b-b4-planning-orchestration` from that SHA; **no new worktree**; no edits to existing branches |
| 2 | **Read-only baseline + design note** | Inspect the B1 agent runtime/FSM/task states, B2 tool registry/executor/audit contracts, B3 permission engine/authorize() PEP, existing appointment approval queues, and workspace safety/kill-switch semantics; write `docs/PHASE_B_B4_DESIGN_NOTE.md`; **no code changes** |
| 3 | **Planning & orchestration module** | Intake/clarify boundary; deterministic plan under step cap; context packer; step DAG scheduler; approval checkpoints in-flight; recovery from interrupted steps; all additive code under `lib/agent/planner/` or similar; feature flag `AGENT_PLANNING_ORCHESTRATION_ENABLED` default **`false`** and hard-off in production |
| 4 | **Tests** | Plan size cap enforced; checkpoint gates cannot be bypassed silently; context never exceeds token cap; recovery from interrupted step; deterministic plan under cap; RLS cross-tenant contract for plan tables; agent role cannot mutate plan tables; fail-closed on missing checkpoint approval; kill-switch drill; **no new dependencies** |
| 5 | **Verification** | `npm run check` + fresh production build; any red ⇒ **STOP + report + wait** |
| 6 | **Evidence + PR** | Commit the evidence report **before** PR creation; create PR `codex/phase-b-b4-planning-orchestration` → `main`, title `DEXYBOR Phase B B4 — planning & orchestration`; **owner merges**; operator does not merge/modify/close |

## 3. Boundaries and exclusions (non-waivable)

- **B4 only.** B5–B9 are not authorized by this instruction.
- **No new dependencies** (OD-B1). If one appears necessary, STOP and request a separate dependency decision.
- **No embeddings / pgvector** (OD-B2).
- **No production access, no deploy, no production or staging migrations.** Migration files only; local/CI disposable replay only through the existing harness; no hosted DB writes.
- **No live OAuth, no external network calls, no model-provider calls, no WhatsApp or calendar calls.**
- **WhatsApp outbound stays `false`.** No agent→WhatsApp send pathway (OD-B11 remains closed).
- **Do not modify** existing appointment, WhatsApp, calendar, outbound, auth, or RLS gates. B4 is additive only.
- **No browser / computer-use** (B7).
- **Flags default off.** The kill switch must leave the planner dormant; rollback = flag off + additive tables.
- **No direct push to `main`; no force-push; no history rewrite; no guard weakening.**
- **One mutation stream at a time.** No parallel Phase B milestones.
- Root strays `page.tsx`, `route.ts` and `.codex-worktrees/` remain untouched.
- The planner must fail closed: a missing, expired, malformed, or unknown checkpoint approval yields DENY; steps beyond the cap cannot proceed.
- Secrets must never appear in logs, audit rows, events, or agent context.

## 4. Stop conditions, validity, revocation

- Immediate STOP: verification failure · PR #234 not merged · `main` moved since pre-flight · unexpected repo state · scope conflict · expiry · any need for a new dependency, real secret, real-database access, or external call.
- Validity: **14 days** from the owner signature date. Any HEAD/`main` change or failed gate ⇒ fresh approval.
- Owner may revoke in writing at any time; revocation is effective immediately.

## 5. Binding tick

```text
[x]  I AUTHORIZE the operator to execute Phase B milestone B4 exactly as written above.
```

## 6. Exception box

```text
EXCEPTED ITEMS (blank = none): ______________________________
Details: ____________________________________________________
```

## S. Owner signature (owner must type these fields personally — operator will not)

```text

Full legal name (typed): yuvraj singh
Authority basis: Repository owner SKLD
Signature (type full name again): yuvraj singh
Date & time typed: 09/11/2026 - __:__ - Timezone: PKT
```

**Status: `PHASE B B4 INSTRUCTION PREPARED — AWAITING OWNER SIGNATURE — NOTHING EXECUTED`**
