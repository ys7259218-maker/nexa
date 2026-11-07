# DEXYBOR AI — VISION → PRODUCT ROADMAP (PROPOSED PLANNING · NO DATES COMMITTED BY THIS ARTIFACT)

**Report:** PB-RM-1 · **Date:** 2026-11-07 · read-only preparation, nothing executed
**Repo:** HEAD `8c70be6` (`codex/appointment-integration-v1`, in sync) · **Stage F: BLOCKED** · **Phase B: NOT STARTED** · **Production release: NO-GO**
**Sources:** owner vision statement (2026-11-07), `DEXYBOR_PHASE_B_ARCHITECTURE_BLUEPRINT.md`, `DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md`, MH-D integration plan, MH-E security proposals, fresh rename scan (§5).

> ## PLANNING ARTIFACT — NOT AUTHORIZATION — NOT A RELEASE CLAIM
> The launch target mentioned by the owner — **March 4, 2027 — is "subject to release gates"** (owner's own wording). Everything below is gate-chain planning. No milestone, no gate, no date is achieved, promised, or started by this document. Production stays NO-GO; `PRODUCTION_RELEASE_APPROVED` guard chain untouched.

---

## 1. Vision anchors (owner statement, recorded verbatim intent)

- Product identity: **DEXYBOR AI — "AI That Talks. AI That Acts."** (repo folder/package still `nexa`; rename = §5 workstream)
- 10 capability pillars: assistant · autonomous agent · computer & browser use · research · coding · memory · tools & integrations · business automation · human approvals · verification/audit.
- Ownership ladder: agent engine → tool execution → memory architecture → workflow engine → permission & verification system → model/inference infrastructure → (long-term) own foundation model. Foundation model explicitly **evidence-gated later**, not near-term (matches OD-B6 ladder; do-not-premature-training stands).
- Strategy sequence: 1 Foundation stabilize → 2 Agent engine → 3 Computer/browser intelligence → 4 Platform expansion → 5 AI-infrastructure ownership.
- Safety invariant: **permission-based execution; no unauthorized actions** (already the verified repo culture: deny-by-default gates, approval queues, RLS allow-lists, audit events; blueprint B3 generalizes it).
- Launch target: **2027-03-04, subject to release gates** ("previously agreed direction, not a claim that milestones are complete").

## 2. The single master gate-chain (upgrade-safe ordering, no parallel mutation streams)

```text
G0 OWNER INSTRUMENTS        signed OD-01 + signed separate execution instruction (+ OD-B P0 rows for Phase B)
G1 STAGE F                  integration branch → preserve → merge origin/main (7 INCLUDE commits + c2b2120 as owner-decided)
                            → conflict resolution (intent-preserving) → full verification matrix → fresh build GREEN
G1B DEPENDENCY HARDENING    authorized MH-E floors (next ≥16.4.1, sentry 10.78.0, sharp, source-map-js, brace-expansion,
                            fast-uri, zod) with before/after audit evidence — merge of G1+G1B in one authorized cycle is fine
G2 PHASE B B1–B2            agent runtime foundation + tool registry (needs OD-B12 sequencing answer + OD-B1, OD-B2)
G3 PHASE B B3–B5            permission/safety engine · planning/orchestration · memory (needs OD-B5, OD-B7 values)
G4 PHASE B B6–B7            model gateway (mock-first; OD-B6 activation order) · browser integration (OD-B4, OD-B10 boundary)
G5 PHASE B B8–B9            evaluation/observability · controlled product integration (needs explicit owner authorization)
G6 CONTROLLED BETA          beta gates: budgets live, kill switches tested, retention values (OD-B5) legal-reviewed,
                            disposable-DB gates (OD-02-equivalent) if used, WhatsApp outbound still false
G7 RELEASE GATES            production guard chain (needs PRODUCTION_RELEASE_APPROVED + non-staging URL + clean preflight,
                            owner-signed) → launch decision by owner ONLY
```

Rule preserved: exactly **one mutation stream at a time** (Stage F first, then Phase B) — parallel workstreams on the unreconciled tree are structurally rejected (OD-B12 recommendation).

## 3. Time model (gate-relative, honest scenario table)

| Launch horizon | Scenario gate chain | Launch content level (owner decides) |
|---|---|---|
| **A (instruments Nov 2026)** | G1+G1B Dec 2026 (est. 1–3 wks post-instruments) → G2–G5 into 2027 → beta pre-2027-03 → 2027-03-04 realistic only for **Level L1–L2** scope | L1 = existing product hardened+integrations (safe) · L2 = + narrow agent-runtime slice (tight) |
| **B (full Agent-Engine-first)** | G2–G6 complete by mid/late-2027 → launch moves beyond 2027-03-04 in this scope | L3 = autonomous agent center-stage — does **not** fit 2027-03-04 without compressing safety gates (rejected by design) |
| Hybrid (recommended framing) | 2027-03-04 launch = **L1/L2**; Agent-Engine core lands as owner-gated beta afterwards (od-B12 sequence preserved) | keeps release-gate integrity + vision trajectory |

No fixed per-milestone calendar is promised; velocities are re-estimated at every gate from real verification results (the repo's own evidence discipline).

## 4. Standing invariants across every gate

1. Feature flags default-off; every notable capability owner-toggled.
2. Full `npm run check` + fresh local build green at each gate boundary; recordings archived.
3. Migrations append-only; disposable-DB tests only if §H-approved instruments exist.
4. WhatsApp outbound pipeline untouched; any agent→WhatsApp concept stays OD-B11-CLOSED unless separately authorized.
5. No production access; release only after G7 with owner signatures.
6. Every gate produces an evidence report (hashes, suite results, build id) — same standard as MH/PB series.

## 5. Rename workstream (nexa → DEXYBOR) — scan evidence (read-only; nothing renamed)

Measured today (`git grep -c -i nexa`, tracked files only):

| Metric | Value |
|---|---|
| Tracked files containing "nexa" (any case) | **126** |
| Total mentions | **293** |
| UI surface files (`app/**`, brand strings visible to users) | **33** (`privacy-policy` ×6, `terms` ×8, dashboard/login/settings etc.) |
| Guard/test/script coupling | ~25 files incl. `lib/operationalDocsTruth.test.ts`, `scripts/checkDocumentedUnitTestCount.ts`, `lib/productionGuard.ts`, `lib/supabaseLocalGate.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.env.example`, `NEXA_*` doc names |
| `package.json` name | `"nexa"` · remote `github.com/ys7259218-maker/nexa.git` · `NEXA_`-prefixed env refs (ci, scripts, guards, README) |

Why it must be an authorized cycle (not a find-replace): docs-truth guard + documented-count script are coupled to exact names/counts (卫士 tests would fail on naive renames); env-key renames touch `productionGuard`/CI expectations; plus remote/GitHub-side rename is an owner action. **Proposed sequence (~1 authorized session + test cycles, placed after G1):** (1) owner instruction row for rename scope; (2) isolated branch from reconciled base; (3) mechanical rename set incl. `package.json` name, brand strings, doc filenames, env keys — with guard tests updated in the same change; (4) full suite + fresh build; (5) owner performs GitHub remote rename; (6) final verification + report. Nothing executed now.

## 6. Current ownership of progress (who must do what, minimal list)

| Owner (only when ready) | Operator (me, immediately after instruments) |
|---|---|
| 2 signed instruments (OD-01 + execution instruction) | fresh formal verification → G1→G1B execution step-by-step |
| OD-B rows (min P0: OD-B12, OD-B1, OD-B2; then P1 batch) | phase-B milestone implementations per blueprint with gates G2–G5 |
| (Optional) rename-scope approval (§5) | rename cycle per §5 |
| Launch level L1/L2/L3 decision (anytime) | gate-chain scheduling refresh |

---

**Status: `VISION→PRODUCT ROADMAP PREPARED (PROPOSED) — PHASE B NOT STARTED — STAGE F BLOCKED — RELEASE NO-GO`**
