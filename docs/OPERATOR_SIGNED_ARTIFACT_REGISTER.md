# OPERATOR SIGNED-ARTIFACT REGISTER — 2026-11-15

> Operator-authored hash register. It records bytes and hashes only. It is **not** an authorization document and grants nothing by itself. The operator typed no owner name, date, signature, initials or decision.

## Artifacts delivered

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `docs/OD-01_OWNER_AUTHORIZATION_SIGNED.md` | 20927 | `503EE07002E54A90082ED55AAF2A2662D5140D661E67F14ECF37056CC5A170E2` |
| `docs/OD_B_P0_SIGNED.md` | 2817 | `2D0BD8F7EE8DAF5F03DC00F0A11A0EA0FDAD363578D8F94CFC9B37ED98C49508` |
| `docs/B6_EXECUTION_INSTRUCTION_SIGNED.md` | 14954 | `571692C3DF643D220C7B52AB311B2368E92693E7EC74E030A7B11D3F168DFD31` |
| `docs/B6_PR_AUTHORIZATION_SIGNED.md` | 5113 | `324EB7536C3C9A43DD86A706F5D635A8FC843DFE5A6B3FB4FE8E11E3327A01FF` |

## Method

- The owner created each Stage-F/B6 file on 2026-11-15 as a copy of its prepared template (`*_DRAFT.md` / `*_QUICK_FILL.md`).
- `B6_PR_AUTHORIZATION_SIGNED.md` was created on 2026-11-15 in three steps: the owner filled Section 4, the owner ran the operator-supplied decision script naming `-R1 Approve -R2 Approve -R3 Approve -Initials YS` on the command line, and the operator then repaired two mechanical faults (a Windows-1252/UTF-8 double-encoded em dash, and a mangled REJECT checkbox) without altering which boxes were ticked.
- The operator then replaced **operator-written lines only**: headers, status lines, verification-checklist claims, and stale repository facts (old `ys725` checkout path, `HEAD a69d35e`, `origin/main 89d6747`).
- Invariant verified after editing: inside OD-01 Section K and B6 Section L, every identity line (name, role, signature, date, timezone) is byte-identical to the pre-edit copy; only the section **heading** line changed.
- Pre-edit copies are kept at `%TEMP%\opencode\signed-backup\`.
- The byte counts and SHA-256 values in the table above describe the delivered working-tree files. `core.autocrlf=true` on Windows, so a delivered `.md` is CRLF on disk while Git stores the LF-normalised blob (for example `B6_PR_AUTHORIZATION_SIGNED.md` is 5113 B in the working tree and 5035 B as a blob, but the same content). Hashing the checked-out file reproduces the table; `git show` does not.

## What these artifacts authorize

| Instrument | Authorizes |
|---|---|
| `OD_B_P0_SIGNED.md` | the three P0 decisions only — OD-B12 (Phase B sequenced after Stage F), OD-B1 (zero new dependencies), OD-B2 (no embeddings now, lexical first) |
| `OD-01_OWNER_AUTHORIZATION_SIGNED.md` | nothing operational — Sections D, E and F contain **0** approved rows |
| `B6_EXECUTION_INSTRUCTION_SIGNED.md` | B6 scope only, and only in combination with the OD-01 approvals |
| `B6_PR_AUTHORIZATION_SIGNED.md` | three operations: R1 push, R2 open the B6 pull request with the prepared body, R3 merge it. All three were executed on 2026-11-15 after the owner delegated the remaining Git/GitHub actions (see the execution record below). |

## Execution record — 2026-11-15

- **Owner delegation.** In chat on 2026-11-15 the owner stated that the remaining Git/GitHub steps would not be performed by them and that the operator should carry them out. The operator therefore pushed, set the pull-request text and merged, which is exactly what the signed R1–R3 rows describe. No owner-typed field was added or altered.
- **Conflict-resolution commit `1d5ff8d`.** PR #237 could not merge (`mergeable_state: dirty`): `main` had advanced to `5365e3b` and five files conflicted. The operator merged `origin/main` into the branch in a separate worktree and resolved them — the branch's superset test list (107 files = `main`'s 103 + the four B6 tests), the branch's 952-test and 33-migration documented counts, and the owner-typed B5 instruction date were kept; `main`'s dependency pins (`react`/`react-dom` 19.3.1, `@playwright/test` 1.64.1) and `main`'s `package-lock.json` and `ci.yml` were taken. No code, migration or test-source line changed.
- **Gate at the merged head.** Fresh `npm ci` plus `npm run check` at `1d5ff8d`: 952/952 unit tests pass, 5/5 issue-report tests pass, lint 0 errors (39 pre-existing warnings), typecheck clean, production build compiles, exit 0.
- **Merge.** PR #237 title `DEXYBOR Phase B B6 — model & inference abstraction`, body from `docs/B6_PR_BODY_DRAFT.md`; merged as `694f2f284d3f41de7a42dbf8df41ad1274411e0d` (parents `5365e3b` and `1d5ff8d`). `origin/main` now contains `lib/ai/{chatModel,routingPolicy,usageLedger,circuitBreaker}.ts` with their tests and `supabase/migrations/20261112000000_agent_usage_ledger_b6.sql` (33 tracked `.sql` migrations plus `README.md`).
- **Credential.** The push and the API calls used the GitHub credential the owner had already stored locally in Windows Credential Manager; it was never written to disk, logged or copied anywhere.

## Open items

- **B6 PR authorization is signed at the final head.** The owner first recorded `APPROVE` on R1–R3 at `8162b7b`; after `b6b6966` was committed and pushed, the operator updated the instrument's factual lines and the owner re-ran the decision script at `b6b6966`. Section 1 (`Source HEAD`), Section 2 (R1–R3) and Section 5 (R1 no-op) all now describe `b6b6966`. The operator's later edit to that file was formatting only (em dash / arrow restoration); no tick state changed.

- **OD-01 Section E3 holds a non-answer.** `docs/OD-01_OWNER_AUTHORIZATION_SIGNED.md` line 98 now shows the destination-branch cell as `___________ F rows में tick___________________________`, which was pasted from operator chat text and does not name a branch. Every other E row is still unapproved, so OD-01 authorizes nothing; the cell should be cleared or replaced by the owner with a real branch name before OD-01 is ever used. The same text was also inserted into the tracked draft `docs/OD-01_OWNER_AUTHORIZATION_DRAFT.md`, which additionally carries `✅` marks appended after (not inside) the E4–E7 approve boxes left unticked, so the draft and the signed copy are no longer identical.

- The signed **B6 PR authorization now covers a merged outcome, but not `1d5ff8d` itself.** Its rows were approved at `b6b6966`; the conflict-resolution merge `1d5ff8d` and the PR merge `694f2f2` happened afterwards under the owner's explicit chat delegation recorded above. The instrument's own "HEAD moved since this signature" condition is therefore satisfied by delegation, not by a new owner-typed row. Any further commit still needs a fresh owner decision.
- OD-B checklist row "SHA-256 recorded in intake register" is left `[ ]` in the delivered file on purpose: the operator does not mark a delivered artifact complete after delivery. This register is the hash record.
- Verbal or chat text cannot sign an instrument. The 2026-11-15 delegation covers execution of the **already-signed** R1–R3 operations only; it does not authorize new scope, a new commit or any B7 work. New scope still needs owner-typed rows.
- B7 remains blocked: it needs an **OD-B4** T4 decision (Playwright runtime browsers / browser-service hosting) and a separate explicit B7 execution instruction. Neither exists.
