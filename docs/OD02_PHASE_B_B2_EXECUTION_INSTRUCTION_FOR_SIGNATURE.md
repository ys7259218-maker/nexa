# OD-02 PHASE B — MILESTONE B2 EXECUTION INSTRUCTION — FOR OWNER SIGNATURE

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S — the operator cannot fill these
> This is the separate, owner-issued execution instruction required for **Phase B milestone B2 (Tool Registry & Execution Contracts)**. It authorizes **B2 only**. B3–B9 each require their own later instruction. A chat message, verbal statement, or agent-prepared text is **not** authorization; only this signed file is.
>
> **Precondition:** B1 PR **#232** must be merged to `main` first. If it is not merged, the operator stops and waits — no B2 branch is created.

**Date of this edition:** 2026-11-08 · **Companion instruments:** signed B1 instruction `OD02_PHASE_B_B1_EXECUTION_INSTRUCTION_SIGNED.md` (`E49CDEC6…`), `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md` §11 (B2), `OD_B_P0_QUICK_FILL.md`.

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
| 1 | **Pre-flight** | Verify PR #232 is merged; record the resulting `main` SHA; confirm clean tree; create branch `codex/phase-b-b2-tool-registry` from that SHA; **no new worktree**; no edits to existing branches |
| 2 | **Read-only baseline + design note** | Inspect the B1 agent tables/runtime, existing tool/audit/permission patterns, and the existing calendar gate adapter; write `docs/PHASE_B_B2_DESIGN_NOTE.md`; **no code changes** |
| 3 | **Additive migration files** | Tool registry + per-invocation audit tables + RLS/grants; append-only dated migration(s); **files only**; no staging or production execution |
| 4 | **Registry + manifests** | Typed manifest format; registry load; strict schema validation; unknown-field rejection; validation/error taxonomy; per-class timeout/retry policy; audit-per-invocation; **hard fail closed** if a manifest is absent or invalid; feature flag `AGENT_TOOL_REGISTRY_ENABLED` default **`false`** and hard-off in production |
| 5 | **First tool families (contracts only)** | File-ops restricted to workspace storage; web-research read-only; calendar-read through the existing gate adapter. Adapters must be injectable/mockable; **no live OAuth, network, provider, WhatsApp, calendar, browser, or filesystem access outside a disposable test sandbox** |
| 6 | **Tests** | Manifest/schema fuzz; unknown fields rejected; audit completeness; per-class timeout; “no direct API call” static boundary test; RLS cross-tenant contract; agent-role grant matrix; registry kill-switch drill; invalid-manifest fail-closed; **no new dependencies** |
| 7 | **Verification** | `npm run check` + fresh production build; any red ⇒ **STOP + report + wait** |
| 8 | **Evidence + PR** | Commit the evidence report **before** PR creation; create PR `codex/phase-b-b2-tool-registry` → `main`, title `DEXYBOR Phase B B2 — tool registry & execution contracts`; **owner merges**; operator does not merge/modify/close |

## 3. Boundaries and exclusions (non-waivable)

- **B2 only.** B3–B9 are not authorized by this instruction.
- **No new dependencies** (OD-B1). If one appears necessary, STOP and request a separate dependency decision.
- **No embeddings / pgvector** (OD-B2).
- **No production access, no deploy, no production migrations.** Migration files only; local/CI disposable replay only through the existing harness; no staging DB writes.
- **No live OAuth, no external network calls, no model-provider calls, no WhatsApp or calendar calls.** B2 tool adapters are contracts and mocks only; live wiring requires a later owner instruction.
- **WhatsApp outbound stays `false`.** No agent→WhatsApp send pathway (OD-B11 remains closed).
- **Do not modify** existing appointment, WhatsApp, calendar, outbound, auth, or RLS gates. Additive only.
- **No browser / computer-use** (B7).
- **Flags default off.** Kill-switch must leave the registry dormant; rollback = flag off + additive tables.
- **No direct push to `main`; no force-push; no history rewrite; no guard weakening.**
- **One mutation stream at a time.** No parallel Phase B milestones.
- Root strays `page.tsx`, `route.ts` and `.codex-worktrees/` remain untouched.
- The registry must never execute a tool whose manifest is absent, invalid, contains unknown fields, or whose class policy is missing.

## 4. Stop conditions, validity, revocation

- Immediate STOP: verification failure · PR #232 not merged · `main` moved since pre-flight · unexpected repo state · scope conflict · expiry · any need for a new dependency or real-database access.
- Validity: **14 days** from the owner signature date. Any HEAD/`main` change or failed gate ⇒ fresh approval.
- Owner may revoke in writing at any time; revocation is effective immediately.

## 5. Binding tick

```text
[x]  I AUTHORIZE the operator to execute Phase B milestone B2 exactly as written above.
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
Date & time typed: 09/11/2026 - 15:45 - Timezone: PKT
**Status: `PHASE B B2 INSTRUCTION PREPARED — AWAITING OWNER SIGNATURE — NOTHING EXECUTED`**
