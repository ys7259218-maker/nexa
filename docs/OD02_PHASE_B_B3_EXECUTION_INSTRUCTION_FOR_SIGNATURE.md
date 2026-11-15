# OD-02 PHASE B — MILESTONE B3 EXECUTION INSTRUCTION — FOR OWNER SIGNATURE

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S — the operator cannot fill these
> This is the separate, owner-issued execution instruction required for **Phase B milestone B3 (Permission & Safety Engine)**. It authorizes **B3 only**. B4–B9 each require their own later instruction. A chat message, verbal statement, or agent-prepared text is **not** authorization; only this signed file is.
>
> **Precondition:** B2 PR **#233** must be merged to `main` first. If it is not merged, the operator stops and waits — no B3 branch is created.

**Date of this edition:** 2026-11-09 · **Companion instruments:** signed B2 instruction `OD02_PHASE_B_B2_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md` (`9C942B62…`), signed B1 instruction `OD02_PHASE_B_B1_EXECUTION_INSTRUCTION_SIGNED.md` (`E49CDEC6…`), `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B3) and §5.D, `OD_B_P0_QUICK_FILL.md`.

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
| 1 | **Pre-flight** | Verify PR #233 is merged; record the resulting `main` SHA; confirm clean tree; create branch `codex/phase-b-b3-permission-safety-engine` from that SHA; **no new worktree**; no edits to existing branches |
| 2 | **Read-only baseline + design note** | Inspect the B1 runtime, B2 registry/executor/audit contracts, existing appointment approval queues, review origin/route guards, workspace safety/kill-switch semantics, calendar token store, and tracked-secret guard; write `docs/PHASE_B_B3_DESIGN_NOTE.md`; **no code changes** |
| 3 | **Additive migration files** | Policy tables, owner/admin grants API, agent approval tables/inbox, credential-broker metadata, and alarm/audit rows; append-only dated migration(s); **files only**; no staging or production execution |
| 4 | **Permission & safety engine** | Single `authorize()` PEP returning ALLOW/CHALLENGE/DENY; deny-by-default tier ladder T0–T5; grants attached to `(workspace, tier, tool family)` with expiry and scope; risk scoring may elevate a tier but never lower it; generalized agent approval engine that does **not** modify existing appointment queues; approval inbox with expiry; credential broker contract that never exposes plaintext secrets to the agent runtime; workspace pause/kill switch; self-grant prohibition enforced at DB, code, and audit layers; fail closed on a missing grant; feature flags default **`false`** and hard-off in production |
| 5 | **Tests** | Self-grant attempt ⇒ DB-denied + audit alarm; approval-expiry race; redaction corpus; T2+ impossible without a logged approval; agent role cannot mutate permission/approval tables; secrets never in logs; fail-closed on missing grant; kill-switch drill; RLS cross-tenant contract; agent-role grant matrix; **no new dependencies** |
| 6 | **Verification** | `npm run check` + fresh production build; any red ⇒ **STOP + report + wait** |
| 7 | **Evidence + PR** | Commit the evidence report **before** PR creation; create PR `codex/phase-b-b3-permission-safety-engine` → `main`, title `DEXYBOR Phase B B3 — permission & safety engine`; **owner merges**; operator does not merge/modify/close |

## 3. Boundaries and exclusions (non-waivable)

- **B3 only.** B4–B9 are not authorized by this instruction.
- **No new dependencies** (OD-B1). If one appears necessary, STOP and request a separate dependency decision.
- **No embeddings / pgvector** (OD-B2).
- **No production access, no deploy, no production or staging migrations.** Migration files only; local/CI disposable replay only through the existing harness; no hosted DB writes.
- **No live OAuth, no external network calls, no model-provider calls, no WhatsApp or calendar calls.** The credential broker is a typed contract with an injected secret source and deterministic mock only; no real credentials are fetched, stored, or logged.
- **WhatsApp outbound stays `false`.** No agent→WhatsApp send pathway (OD-B11 remains closed).
- **Do not modify** existing appointment, WhatsApp, calendar, outbound, auth, or RLS gates. The agent approval engine is additive and must not alter the existing appointment review queues.
- **No browser / computer-use** (B7).
- **Flags default off.** The kill switch must leave the permission engine dormant; rollback = flag off + additive tables.
- **No direct push to `main`; no force-push; no history rewrite; no guard weakening.**
- **One mutation stream at a time.** No parallel Phase B milestones.
- Root strays `page.tsx`, `route.ts` and `.codex-worktrees/` remain untouched.
- The engine must fail closed: a missing, expired, malformed, or unknown grant yields DENY; T2+ can never proceed without a logged, unexpired approval.
- The agent runtime role must have no INSERT/UPDATE/DELETE on permission or approval tables; grants are owner/admin-only through reviewed RPCs.
- Self-grant attempts must be DB-denied and produce an audit alarm. Secrets must never appear in logs, audit rows, events, or agent context.
- No plaintext secret may cross into the agent runtime; the broker serializes only at the execution edge.

## 4. Stop conditions, validity, revocation

- Immediate STOP: verification failure · PR #233 not merged · `main` moved since pre-flight · unexpected repo state · scope conflict · expiry · any need for a new dependency, real secret, real-database access, or external call.
- Validity: **14 days** from the owner signature date. Any HEAD/`main` change or failed gate ⇒ fresh approval.
- Owner may revoke in writing at any time; revocation is effective immediately.

## 5. Binding tick

```text
[x]  I AUTHORIZE the operator to execute Phase B milestone B3 exactly as written above.
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
Date & time typed: 09/11/2026 - 16:35 - Timezone: PKT
```

**Status: `PHASE B B3 INSTRUCTION PREPARED & OWNER-SIGNED — NOTHING EXECUTED`**

