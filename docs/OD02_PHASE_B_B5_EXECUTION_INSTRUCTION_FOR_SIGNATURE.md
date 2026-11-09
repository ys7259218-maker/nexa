# OD-02 PHASE B — MILESTONE B5 EXECUTION INSTRUCTION — FOR OWNER SIGNATURE

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S — the operator cannot fill these
> This is the separate, owner-issued execution instruction required for **Phase B milestone B5 (Memory System)**. It authorizes **B5 only**. B6–B9 each require their own later instruction. A chat message, verbal statement, or agent-prepared text is **not** authorization; only this signed file is.
>
> **Precondition:** B4 PR **#235** must be merged to `main` first. If it is not merged, the operator stops and waits — no B5 branch is created.

**Date of this edition:** 2026-11-09 · **Companion instruments:** signed B4 instruction `OD02_PHASE_B_B4_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, signed B3 instruction `OD02_PHASE_B_B3_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, signed B2 instruction `OD02_PHASE_B_B2_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md`, signed B1 instruction `OD02_PHASE_B_B1_EXECUTION_INSTRUCTION_SIGNED.md`, `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B5) and §E, `OD_B_P0_QUICK_FILL.md`.

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
| 1 | **Pre-flight** | Verify PR #235 is merged; record the resulting `main` SHA; confirm clean tree; create branch `codex/phase-b-b5-memory-system` from that SHA; **no new worktree**; no edits to existing branches |
| 2 | **Read-only baseline + design note** | Inspect the B1 agent runtime/tasks/steps tables, B2 tool registry/executor/audit contracts, B3 permission engine/authorize() PEP, B4 planning/orchestration module, existing `knowledge_entries` table; write `docs/PHASE_B_B5_DESIGN_NOTE.md`; **no code changes** |
| 3 | **Additive migration files** | Memory layer tables (M1 session scratchpad, M2 task memory, M3 user-approved persistent memory, M5 external data references), retention/deletion cascade, consent records, consent UI/contract pack; append-only dated migration(s); **files only**; no staging or production execution |
| 4 | **Memory system services** | Memory services for M1–M5 layers with retention/deletion/access controls; M3 consent flow (explicit facts the user chose to keep, until user edits/deletes); M5 references-only default (URLs/IDs only, never bulk-fetched copies without retention policy); RLS by `workspace_id` on all layers; deletion APIs cascade M1–M3/M4 for a tenant |
| 5 | **Tests** | Retention honored; deletion cascades; consent records auditable; no unbounded context growth; cross-tenant probes; PII-scan fixtures; consent missing ⇒ not stored; injection via memory reads (fixtures); RLS cross-tenant contract; agent role cannot mutate memory tables; fail-closed on missing consent; kill-switch drill; **no new dependencies** |
| 6 | **Verification** | `npm run check` + fresh production build; any red ⇒ **STOP + report + wait** |
| 7 | **Evidence + PR** | Commit the evidence report **before** PR creation; create PR `codex/phase-b-b5-memory-system` → `main`, title `DEXYBOR Phase B B5 — memory system`; **owner merges**; operator does not merge/modify/close |

## 3. Boundaries and exclusions (non-waivable)

- **B5 only.** B6–B9 are not authorized by this instruction.
- **No new dependencies** (OD-B1). If one appears necessary, STOP and request a separate dependency decision.
- **No embeddings / pgvector** (OD-B2). M4 knowledge retrieval uses existing `knowledge_entries`; embeddings remain deferred.
- **No production access, no deploy, no production or staging migrations.** Migration files only; local/CI disposable replay only through the existing harness; no hosted DB writes.
- **No live OAuth, no external network calls, no model-provider calls, no WhatsApp or calendar calls.**
- **WhatsApp outbound stays `false`.** No agent→WhatsApp send pathway (OD-B11 remains closed).
- **Do not modify** existing appointment, WhatsApp, calendar, outbound, auth, or RLS gates. B5 is additive only.
- **No browser / computer-use** (B7).
- **Flags default off.** Memory layers independently disable; M3 off ⇒ context collapses to M0 (existing). Rollback = flag off + additive tables.
- **No direct push to `main`; no force-push; no history rewrite; no guard weakening.**
- **One mutation stream at a time.** No parallel Phase B milestones.
- Root strays `page.tsx`, `route.ts` and `.codex-worktrees/` remain untouched.
- **M0 conversation context (bounded recent turns, existing) is untouched** — B5 does not modify existing conversation context retention.
- **PII-minimization scan before M3 persistence** — no plaintext PII in memory layers.
- **No cross-tenant read** — deny-by-default RLS tested with adversarial fixtures.
- **M5 references-only default** — URLs/IDs only, never bulk-fetched copies without retention policy.
- **M3 requires explicit consent** — consent missing ⇒ not stored; consent records auditable.

## 4. Stop conditions, validity, revocation

- Immediate STOP: verification failure · PR #235 not merged · `main` moved since pre-flight · unexpected repo state · scope conflict · expiry · any need for a new dependency, real secret, real-database access, or external call.
- Validity: **14 days** from the owner signature date. Any HEAD/`main` change or failed gate ⇒ fresh approval.
- Owner may revoke in writing at any time; revocation is effective immediately.

## 5. Binding tick

```text
[x]  I AUTHORIZE the operator to execute Phase B milestone B5 exactly as written above.
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

B5 INSTRUCTION PREPARED — AWAITING OWNER SIGNATURE — NOTHING EXECUTED`**
