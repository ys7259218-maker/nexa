# OD-01 MINI AUTHORIZATION — FOR OWNER SIGNATURE (RECOMMENDED-DEFAULTS EDITION)

> ## INVALID UNTIL OWNER TYPES NAME + DATE IN SECTION S — the operator cannot fill these
> This one-page instrument adopts, **by explicit reference**, the full OD-01 authorization (all sections A–K of `docs/OD-01_OWNER_AUTHORIZATION_DRAFT.md`) with the **operator's recommended options enumerated below**. Signing adopts every listed item **exactly as written**; any exception must be written in the EXCEPT box before signing. Operator-prepared text is not authorization; only the owner-typed name + date below constitutes the decision.

**Date of this edition:** 2026-11-07 · **Companion:** `OD01_MINI_EXECUTION_INSTRUCTION_FOR_SIGNATURE.md` (must both be signed for Stage F)

---

## 1. What signing covers (every item visible, nothing hidden)

| # | Item | Adopted option |
|---|---|---|
| R1 | Repository & refs | nexa repo (remote `ys7259218-maker/nexa`); work branch `codex/appointment-integration-v1` @ `8c70be6`; merge source `origin/main` @ `3c10dca` |
| R2 | Preservation | C1 verified one-time copy **APPROVE** · C2 SHA-256 manifest **APPROVE** · C4 preserve all modified+untracked (deletion prohibited) **APPROVE** |
| R3 | Integration branch | C3 **APPROVE** — name `codex/merge-harden-integration` (branch only, no new worktree) |
| R4 | Commits (per OD-01 §D) | `80cc24c`, `18b6acf`, `4f2967a`, `5aaff15`, `141a81a`, `4210993`, `3c10dca` = **APPROVE** (7 rows) · **`c2b2120` (PR #215) = DEFER** (separate owner-review cycle later) |
| R5 | Merge authorizations (§E) | E1–E7 **APPROVE** — destination for PR = **`main`** (via PR only); conflict policy: intent-preserving, blind ours/theirs prohibited, sensitive files escalate to owner |
| R6 | Permissions (§F) | commit/merge **APPROVED (scope = this instruction)** · push-to-main direct + force-push **NOT APPROVED** · PR creation **APPROVED** (source `codex/merge-harden-integration` → target `main`, title "DEXYBOR Stage F — integration & hardening", contents = work-preserved diff + merge) · PR modify/close **NOT APPROVED** |
| R7 | Dependency floors (§G) | next ≥16.4.1 · @sentry/nextjs 10.78.0 · sharp ≥0.35.5 · source-map-js ≥1.2.2 · brace-expansion ≥1.1.21/≥5.0.12 · fast-uri ≥3.1.9 · zod ≥4.6.6 · lockfile edits restricted to these rows — **all APPROVE** (constraints intact: no `npm audit fix/--force`, no majors, before/after audit evidence) |
| R8 | Verification (§H) | full local matrix + fresh build **AUTH** · disposable-DB integration tests **NOT APPROVED** (stays closed) |
| R9 | Worktree prune (§C-extra) | **APPROVE** — the 5 stale registrations only; branches kept |
| R10 | Root strays (`page.tsx`, `route.ts`) | **LEAVE UNTOUCHED** (C5 default) |
| R11 | Exclusions (§I) | all eleven standing exclusions **UNSIGNED-STRONG** (no deploy, no prod migrations, no live OAuth, WhatsApp outbound stays `false`, no prod secrets/env/data, no history rewrite, no guard weakening) |
| R12 | Validity (§J) | 14 days from signature date · any scope change/HEAD-change/failed gate ⇒ fresh approval · excess scope ⇒ immediate stop |

## 2. Exception box (write ONLY if adopting something differently)

```text
EXCEPTED ITEMS (blank = none): ______________________________
Details: ____________________________________________________
```

## 3. Binding tick (single, covers enumerated list above)

```text[x] I ADOPT every row R1–R12 exactly as written  (with/without my Section-2 exceptions)
```

## S. Owner signature (owner must type these fields personally — operator will not)

```text
```
Full legal name (typed): __yuvraj singh____________________________
Authority basis: Repository owner
Signature (type full name again): _yuvraj singh_____________________________
Date & time typed: 07/11/2026 — 23:55 — Timezone: PKT
*Operator intake rule: if these fields are found blank or pre-filled by non-owner hands, the instrument is VOID and Stage F stays blocked.*

**Status: `MINI AUTHORIZATION PREPARED — AWAITING OWNER TYPED SIGNATURE — STAGE F BLOCKED`**
