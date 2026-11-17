# DEXYBOR Phase B — launch plan to 4 December 2026

> Operator-prepared plan. It authorizes nothing and records no owner decision. Every date below depends on the owner signing the instrument named against it. Nothing in this plan starts B8 or B9 code before its signed scope exists.

**Prepared:** 2026-11-16
**Target launch date:** Friday, 4 December 2026
**Repository:** `C:\Users\Asus\nexa` (remote `https://github.com/ys7259218-maker/nexa.git`)
**Verified baseline:** B7 merged on the remote as `c7304bf9dc5d76addd42014ec8f74d5b12aaf8f2` (PR #250, merged by the owner 2026-11-16T15:26:29Z). The B8 branch `codex/phase-b-b8-eval-observability` was created from that commit; local `main` and the local `origin/main` ref are still at `603df52` and have not been fetched since the merge.
**Evidence at `bb3a5df` (B7 head):** `npm run check` exit 0, 989/989 tests, 34 tracked migrations, lint 0 errors, typecheck clean, production build compiles.
**B8 evidence at the current uncommitted head (2026-11-17):** `npm test` 1045/1045 pass, 0 fail; `npm run eval:agent` 6/6 cases passed; `npm run check:agent-matrix` 70 mapped cases across 7 milestones and 9 B8 test files registered; `npm run check:documented-count` matches; `tsc --noEmit` clean; `eslint` 0 errors (40 pre-existing warnings); still 34 tracked migrations, no new table and no new dependency. Nothing is committed, pushed or deployed.

---

## 1. Launch definition (what "launch" means on 4 Dec)

| Item | Decision carried into this plan |
|---|---|
| Product surface | Existing Next.js app (auth, dashboard, AI employee CRUD, inbound WhatsApp with draft-blocked replies) |
| Agent surface | B1-B8 shipped **dormant**: `AGENT_RUNTIME_ENABLED=false`, `AGENT_TOOL_REGISTRY_ENABLED=false`, `BROWSER_AGENT_ENABLED=false`, `BROWSER_DRIVER=mock`, `WHATSAPP_OUTBOUND_ENABLED=false` |
| Outbound WhatsApp | **Not** part of this launch. It needs Meta verification **and** a separate signed OD-B11 + agent-to-WhatsApp pathway authorization |
| B9 console | Desired but conditional; needs explicit owner authorization **and** Stage F resolution. Fallback is post-launch (section 6) |
| Production database | No B4-B8 migration is applied to a hosted project by this plan; hosted application remains the owner's separate decision |
| What the owner gets on 4 Dec | A verified, documented, rollback-ready repository state that can be released behind flags, plus the launch evidence pack |

If any of these assumptions is wrong, the plan changes before 4 Dec, not during it.

---

## 2. Critical path

```text
16 Nov  B8 package drafted (this plan + instruction + matrix + action sheet)   [done]
17 Nov  Owner signs B8 prerequisite row + B8 execution instruction               [done]
17 Nov  B8 implementation (operator) + tests, verified at 1045 tests             [done, uncommitted]
24 Nov  B8 verification record + B8 push/PR authorization draft -> owner signs
25 Nov  B8 PR opened -> owner merges (R3); remote main advances
26 Nov  B9 go/no-go decision (Stage F dependency)
26-30   B9 scope sign + implementation, OR fallback to release-only track
1 Dec   Full release verification from a clean clone
2 Dec   Release evidence pack + owner GO/NO-GO
3 Dec   Buffer: rollback rehearsal, docs freeze, defect triage only
4 Dec   Launch (owner executes release; operator supports, does not deploy)
```

**Slack:** zero explicit buffer except 3 Dec. Any slip of more than one working day on 18-23 Nov consumes 3 Dec. Slip beyond that moves launch; it does not compress verification.

**Current position (2026-11-17):** the B8 implementation landed early and is verified at the uncommitted head (1045/1045 tests, `eval:agent` 6/6, `check:agent-matrix` 70 cases, lint 0 errors, typecheck clean, 34 migrations). Nothing is committed, pushed, opened or merged. The next owner action is still the `R0-R3` B8 PR authorization before the 24 Nov row.

---

## 3. Workstreams and owner gates

| # | Workstream | Owner instrument | Date | Blocking? |
|---|---|---|---|---|
| 1 | B8 prerequisite handling (OD-B5 retention, OD-B7 budget values still `PENDING OWNER DECISION`) | B8 instruction row **C0a** (B8 sets no retention/budget values; reports `unconfigured`) | 17 Nov | Yes |
| 2 | B8 execution scope | `docs/B8_EXECUTION_INSTRUCTION_DRAFT.md` (owner-filled; the signed instrument stays local, no `_SIGNED.md` copy exists) | 17 Nov | Yes |
| 3 | B8 push/PR | `docs/B8_PR_AUTHORIZATION_DRAFT.md` (R0-R3) | 24 Nov | Yes |
| 4 | B8 merge | Owner merges the PR (R3) | 25 Nov | Yes |
| 5 | B9 authorization | Explicit owner authorization + Stage F resolution | 26 Nov | Yes for B9 only |
| 6 | Release GO/NO-GO | Owner-signed release decision | 2 Dec | Yes |
| 7 | Meta business verification | External (Meta) + owner Live/Publish toggle | any time before outbound | No for flags-off launch |

**Why OD-B5/OD-B7 are handled by a waiver row, not silently assumed:** the decision matrix still shows both as `PENDING OWNER DECISION`. B8 does not need their values to build a read-only observability layer, but it must not invent retention windows or budget ceilings. Row C0a makes that explicit and is the only prerequisite the owner can close cheaply on 17 Nov. Optionally the owner decides OD-B5/OD-B7 in the same sitting; then C0a becomes moot but stays recorded.

Also still open in the matrix and **not** consumed by B8: OD-B4 (browser hosting), OD-B10 (computer-use deferral), OD-B12 (sequencing), OD-B3 (worker hosting). B8 re-runs the B7 mock suite only; it does not install or launch a real browser, so OD-B4 is not on the B8 path.

---

## 4. B8 scope summary (detail in the instruction draft)

Lean and additive:

1. Deterministic offline eval harness under `lib/agent/eval/` plus `npm run eval:agent`.
2. Scenario packs replaying B1/B3/B4/B5/B7 flows against in-memory stores and the mock browser driver.
3. Machine-readable threat-matrix map (B1-B7 case IDs -> test files) with a static integrity check; a full green `npm test` at head is the actual re-run.
4. VERIFYING evidence checks behind `AGENT_VERIFY_EVIDENCE_ENABLED` (default off); checker error fails closed to `FAILED`.
5. Read-only, content-free observability aggregates and one read-only route, double-gated and production-404.
6. Advisory watchdog (stale lease, stuck VERIFYING, repeated failures, budget breach) - **no auto-remediation**.
7. DR runbook text (`docs/B8_DR_RUNBOOK.md`), no drill execution.
8. **No new migration, no new table, no new dependency.**

Estimated effort: 5-7 operator days. If it grows past that, the stop condition is to trim C2 scenario packs, not to skip C4/C5/C6 tests.

---

## 5. B9 status and risk

Blueprint B9 requires B1-B8 **plus explicit owner authorization and Stage F resolution**. B9 also contradicts nothing in the existing draft/WA pipeline only if that pipeline is not modified - any modification is a fail condition.

| Risk | Impact | Mitigation |
|---|---|---|
| Stage F resolution not available by 26 Nov | B9 cannot start | Fallback: launch 4 Dec with B1-B8 flags-off, B9 after launch under its own authorization |
| B9 console touches draft/WA flow | Existing pipeline test changes | Hard stop; revert branch; B9 re-scoped additively |
| B9 grows into customer-visible agent action | Unauthorized capability | `WHATSAPP_OUTBOUND_ENABLED` stays `false`; no send pathway in B9 |

**Owner decision needed by 26 Nov:** "B9 before 4 Dec" or "B1-B8 launch, B9 after". Operator will not choose this.

---

## 6. Release gates (2-3 Dec)

| Gate | Requirement | Evidence |
|---|---|---|
| R1 Clean-room build | Fresh clone of the release commit, `npm ci`, `npm run check` exit 0 | command log + exit codes |
| R2 Migration integrity | 34 tracked migrations (or +0 from B8); existing files byte-identical; local disposable replay passes | migration count test + replay log |
| R3 Test count truth | `npm test` count equals documented count | `check:documented-count` |
| R4 Flag inventory | Every agent/browser/outbound flag defaults to off/false/mock in code and env templates | grep + review table |
| R5 Secret scan | `check:tracked-secrets` green | command log |
| R6 Production guard | `check:production-build` green; `PRODUCTION_RELEASE_APPROVED` not weakened | command log |
| R7 Docs truth | Handoff/GO_LIVE counts and B7/B8 merge records match reality | docs diff review |
| R8 Rollback proof | Flag-off rollback and code revert steps written and walked through (no live action) | rollback section + reviewer initials |
| R9 Owner GO/NO-GO | Owner-signed release decision naming the commit | signed instrument |
| R10 External status | Meta verification status recorded; outbound remains off regardless | status note |

Launch is **NO-GO** if any of R1-R9 fails, or if any agent flag is on by default.

---

## 7. Day-by-day owner actions

| Date | Owner action | Operator action |
|---|---|---|
| 17 Nov | Fill `docs/B8_EXECUTION_INSTRUCTION_DRAFT.md` (Sections A, B, C0a, C, E, L) | Freeze the package at the signed hash; create branch only after signature |
| 24 Nov | Sign B8 push/PR authorization (R0-R3) | Report verification numbers at the exact head |
| 25 Nov | Merge the B8 PR yourself | Nothing is pushed or merged before the signature |
| 26 Nov | Decide B9-before-launch vs B1-B8 launch | Prepare both tracks; execute only the signed one |
| 2 Dec | Sign release GO/NO-GO | Deliver evidence pack with command logs |
| 4 Dec | Execute release; keep outbound off | On-call support, no production mutation without instruction |

Chat approval does not substitute for any row above.

---

## 8. Stop conditions for the whole plan

| Condition | Action |
|---|---|
| B8 instruction unsigned by end of 18 Nov | Launch date moves; no compression of verification |
| `npm run check` red and not fixed within one day | STOP, report, re-plan |
| Any request to enable browser/provider/outbound to "save time" | STOP - separate signed instrument required |
| Any need for a new dependency, hosted DB, production access, or real browser | STOP - out of B8 scope |
| Owner revokes or narrows scope in writing | Effective immediately |
| B7 remote merge record cannot be reproduced (`c7304bf` reachable on remote) | Resolve before any release evidence pack |

---

## 9. What this plan deliberately does not do

- It does not treat B7's merged status as authorization for B8 or B9.
- It does not resolve OD-B5, OD-B7, OD-B4, OD-B10, OD-B11, OD-B12, or Stage F.
- It does not promise outbound WhatsApp on 4 Dec.
- It does not promise B9 on 4 Dec.
- It does not move any migration to a hosted project.

**Status:** `B8 IMPLEMENTATION COMPLETE AND VERIFIED AT 1045 TESTS - UNCOMMITTED - AWAITING OWNER SIGNATURE ON B8 PR AUTHORIZATION (R0-R3) - NO PUSH/PR/MERGE - NO DEPLOY - B9 BLOCKED`
