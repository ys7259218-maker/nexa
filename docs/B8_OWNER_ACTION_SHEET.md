# B8 OWNER ACTION SHEET — what to sign, in order

> Operator-prepared navigation sheet. It grants nothing and records no decision. Only the owner's own ticks and typed name/date count. Do not ask the operator to fill these boxes.

**Prepared:** 2026-11-16
**Baseline:** B7 merged on remote `main` as `c7304bf` (PR #250); local checkout `bb3a5df`
**Why you are seeing this:** B8 is the evaluation/observability milestone. Two decision-matrix rows (OD-B5 retention, OD-B7 budget values) are still `PENDING OWNER DECISION`. B8 can be built without them, but only if you say so in writing. That is the first tick below.

---

## Step 1 — choose how to handle OD-B5 / OD-B7 (required before any B8 code)

**Recommended (fastest, one tick):** open `docs/B8_EXECUTION_INSTRUCTION_DRAFT.md`, Section C, row **C0a**.

- Tick: `[ ]` **Approve**
- What it means: B8 builds read-only observability but sets **no** retention windows and **no** budget ceilings. Where a value would be needed it reports `unconfigured`. You can decide OD-B5/OD-B7 later without changing B8 code.
- Sign with initials in the row.

**Alternative (full decisions):** open `docs/DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md` and decide OD-B5 and OD-B7 there. Do not ask the operator to fill those boxes.

Do not leave both undone: B8 stays stopped at the gate.

---

## Step 2 — sign the B8 execution instruction

1. Create your own copy `docs/B8_EXECUTION_INSTRUCTION_SIGNED.md` from the draft. The operator will not create or edit the signed copy for you (same rule as B7).
2. **Section A:** type your name, role, date/time, timezone.
3. **Section B:** confirm the repository lines and **name the source branch and destination branch yourself**. Destination should not be `main` unless you explicitly want it.
4. **Section C:** tick Approve / Reject / Defer for each row you have actually decided. C0a is the prerequisite row. Rows you leave unticked are not approved.
5. **Section E:** tick each file you permit. If you want a narrower B8, strike rows (for example drop C2d/C2e scenario packs) rather than leaving them ambiguous.
6. **Section L:** type your name and signature again. Leave the operator acknowledgment blank for the operator.
7. Do not change the operator-written facts silently; if something is stale, note it and correct it visibly.

The 41 cases in `docs/B8_SECURITY_TEST_MATRIX.md` need no signature. Review them if you want. The six open design points at the end of that file are the ones where your preference changes the code:
watchdog thresholds, route exposure, whether `check` includes the matrix check, evidence-check failure mode, DR cadence/RPO/RTO, and browser cases staying out of B8.

---

## Step 3 — after implementation: B8 push/PR authorization

1. Operator reports the exact verified head: `npm run check` exit code, test count, migration count, `eval:agent`, `check:agent-matrix`.
2. Operator prepares a B8 push/PR authorization draft (same shape as B7, R0-R3).
3. You sign R0 (push), R1/R2 (open PR), R3 (merge).
4. **You merge the PR yourself.** The operator does not merge.

Nothing is pushed, no branch is created, and no PR is opened before Step 2 is signed.

---

## Step 4 — B9 decision (needed by 26 November, not now)

B9 (console/UI) needs explicit owner authorization **and** Stage F resolution. Two options:

- **A:** B9 before launch - higher risk, tighter schedule.
- **B (fallback in the launch plan):** launch 4 Dec with B1-B8 shipped dormant; B9 after launch under its own authorization.

The operator will not choose this. If you say nothing, plan B runs.

---

## What stays prohibited even after signing B8

- Computer-use and real browser launch (OD-B10, OD-B4 untouched).
- Provider activation, API keys, model calls (OD-B6).
- WhatsApp outbound or any agent-to-WhatsApp send (OD-B11).
- Setting retention windows or budget ceilings inside B8 (OD-B5, OD-B7).
- Watchdog auto-remediation (requeue, cancel, kill, retry, flag flip).
- B9 console/UI work.
- New npm dependencies, new migration/table.
- Production deploy, hosted migrations, live OAuth/calendar calls.
- Deleting or weakening an existing test to make a suite green.

---

## What happens after you sign Step 1 + Step 2

1. Operator records the SHA-256 of your signed instruction and starts the B8 branch from the signed base.
2. Implementation follows Sections C/E only; any extra file needs a fresh owner row.
3. `npm run check`, `npm run eval:agent` and `npm run check:agent-matrix` must be green at the exact head before Step 3.
4. Release evidence for the 4 Dec gate comes from the same head; no re-labelling of older logs.

---

**Status:** `B8 IMPLEMENTATION COMPLETE AND VERIFIED AT 1045 TESTS — NOTHING COMMITTED — AWAITING OWNER SIGNATURE ON B8 PR AUTHORIZATION (R0-R3)`

---

## Operator note added 2026-11-17 (not an owner entry)

The owner filled the draft in place on 2026-11-16 instead of creating a separate copy, and signed a separate completion addendum authorizing the operator to transcribe the clerical entries. The signed instrument is therefore `docs/B8_EXECUTION_INSTRUCTION_DRAFT.md` (SHA-256 `3530B9C4F1C60174D2E8A27F6B0C53EAB9C12B4E6505695261ED7779F3583E7B`) and **no** `docs/B8_EXECUTION_INSTRUCTION_SIGNED.md` copy exists. Implementation is complete and green; Step 3 (`R0-R3` in `docs/B8_PR_AUTHORIZATION_DRAFT.md`) is the only owner action left, and nothing is pushed before it.
