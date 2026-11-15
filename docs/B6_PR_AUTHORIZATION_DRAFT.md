# B6 PR AUTHORIZATION — DRAFT FOR OWNER SIGNATURE

> ## NOT AUTHORIZATION UNTIL THE OWNER TYPES THE FIELDS IN SECTION 4
> Operator-prepared draft. The operator typed no owner name, date, signature, initials, or decision. A chat message, verbal statement, or agent-prepared text is **not** authorization. Only this file, completed and signed personally by the owner, authorizes the three operations in Section 2 — nothing else.

**Prepared:** 2026-11-15 (operator — technical execution only, not an owner and not an approver)
**Repository:** `C:\Users\Asus\nexa` (remote `https://github.com/ys7259218-maker/nexa.git`)
**Status at preparation (verified read-only on 2026-11-15):** branch `codex/phase-b-b5-memory-system` at `8162b7b`, 16 commits ahead of `origin/main` (`5365e3b`). `npm run check` green: 952/952 tests, lint 0 errors, typecheck clean, production build compiles.

**Why this instrument exists:** `docs/OD-01_OWNER_AUTHORIZATION_SIGNED.md` is scoped to the earlier Stage F merge (source `origin/main` @ `3c10dca`, commits from PRs #215–#223). It contains no B6 commit rows, so its Sections D/E/F cannot authorize a B6 pull request. This draft covers that single gap and changes nothing in any existing instrument.

---

## 1. Exact scope this instrument covers

| Item | Value |
|---|---|
| Milestone | Phase B — **B6 Model & Inference Abstraction only** |
| Source branch | `codex/phase-b-b5-memory-system` |
| Source HEAD | `8162b7b` |
| Destination | `main` (current `5365e3b`) |
| Commits covered | `8f3a3f5`, `4d1fb78`, `cff8d75`, `b0ec454`, `609ab7b`, `f712ef4` (the six B6 commits) + `8162b7b` (owner-record/docs preservation commit) |
| Migrations | one additive file, `supabase/migrations/20261112000000_agent_usage_ledger_b6.sql`; the 32 pre-existing files are byte-identical |
| Dependencies | zero added or changed |
| Test evidence | 952 unit tests pass, 0 fail; `npm run check` exit 0 at `8162b7b` |

---

## 2. The ONLY operations authorized (choose per row)

| # | Operation | Boundary | Owner decision |
|---|---|---|---|
| R1 | Push the existing branch to `origin` if it is not already current (fast-forward only) | Never force-push; no other branch touched | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ______ |
| R2 | Open a pull request `codex/phase-b-b5-memory-system` → `main`, title `DEXYBOR Phase B B6 — model & inference abstraction` | PR text only; no merge by the operator | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ______ |
| R3 | Owner merges the PR; operator then does nothing further without a new instruction | Operator never merges, closes, or modifies the PR | `[ ]` APPROVE `[ ]` REJECT `[ ]` DEFER — initials ______ |

---

## 3. Explicitly NOT authorized (non-waivable)

- B7, B8, B9 — not started, no browser/computer-use runtime.
- Any dependency change; any embedding or pgvector work.
- Any production deploy, hosted/staging database write, or migration execution.
- Any live OAuth, model-provider call, WhatsApp send, or calendar call. `AI_PROVIDER` stays `mock`; `WHATSAPP_OUTBOUND_ENABLED` stays `false`.
- Any edit to auth, RLS, appointment, calendar, outbound or WhatsApp gates.
- Any force-push, history rewrite, rebase, `git clean`, `reset --hard`, or stash.
- Any change to the WhatsApp pipeline.
- Any commit created by the operator for this purpose.

**Stop conditions:** HEAD or `origin/main` moved since this signature · any gate red · scope conflict · expiry (14 days from signature) · any need for a secret, real database, or external call · owner revocation in writing (immediate effect).

---

## 4. Owner fields — the owner must type these personally

```text
Full legal name (typed): ______YUVRAJ SINGH________________________
Authority basis: __________SKLD__________________________
Signature (type full name again): _____YUVRAJ SINGH_______________
Date & time typed: __14____ / __11____ / __2026______ — __10__ : __30__ — Timezone: _PKT_______

[x]  I AUTHORIZE the three operations marked APPROVE in Section 2, and nothing else.
```

*Operator intake rule: if these fields are blank, or were filled by anyone other than the owner, this instrument is VOID and no PR is opened.*

---

## 5. Operator notes

- This draft authorizes no action by itself and was not executed against.
- After the owner saves a signed copy, the operator will: re-verify HEAD/origin/main, re-run `npm run check`, then perform only the approved rows.
- No hashes are recorded here; they will be recorded in `docs/OPERATOR_SIGNED_ARTIFACT_REGISTER.md` at delivery.
