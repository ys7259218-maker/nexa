# OD-B P0 QUICK-FILL SHEET (3 DECISIONS · ~2 MINUTES) — TEMPLATE, ALL FIELDS BLANK

**Purpose:** fastest possible owner instrument for the **three P0 decisions** that unlock Phase B planning (per `DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md`). The full matrix remains the canonical register; a completed copy of this sheet is **cross-referenced only** — it does not authorize any implementation by itself (execution needs its separate explicit instruction, and Stage F needs its own 2 signed files).

## How to complete (owner only)

1. Tick exactly one box per decision → fill initials + date + (optional) one-line rationale.
2. Save as a **new file** named e.g. `OD_B_P0_SIGNED.md` (do not overwrite any template).
3. Deliver to the operator — it will be hashed and registered like every other instrument.

---

## OD-B12 — Phase B workstream sequencing vs Stage F

Recommendation on the table: **after Stage F reconciliation** (sequenced; no parallel mutation streams).

```text
Decision:
[ ] Approve recommendation (after Stage F)
[ ] Reject recommendation
[ ] Request changes / Defer
Owner rationale: ______________________________
Owner initials: ________   Decision date: ______ / ______ / ________
```

## OD-B1 — Schema/contract typing (dependency policy for Phase B)

Recommendation on the table: **zero-new-dependencies typed contracts + one small internal validator util** (library adoption revisit later via an authorized dependency cycle, if evidence demands).

```text
Decision:
[ ] Approve recommendation
[ ] Reject recommendation
[ ] Request changes / Defer
Owner rationale: ______________________________
Owner initials: ________   Decision date: ______ / ______ / ________
```

## OD-B2 — pgvector vs no-embeddings-for-now

Recommendation on the table: **no embeddings now**; lexical retrieval first; schema kept vector-ready; revisit later on evidence (enabling later = fresh decision, never automatic).

```text
Decision:
[ ] Approve recommendation
[ ] Reject recommendation
[ ] Request changes / Defer
Owner rationale: ______________________________
Owner initials: ________   Decision date: ______ / ______ / ________
```

---

## Operator intake checklist (filled at delivery, not now)

```text
[ ] Exactly one box ticked per decision, no others
[ ] Initials + dates present; handwriting/typed name recorded as-is
[ ] Saved as NEW file (no template overwritten)
[ ] Consistency check vs full matrix run (conflict ⇒ STOP & report)
[ ] SHA-256 recorded in intake register
```

**Status: `OD-B P0 QUICK-FILL PREPARED — AWAITING OWNER DECISIONS — PHASE B IMPLEMENTATION NOT STARTED`**
