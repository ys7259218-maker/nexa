# PR BODY DRAFT — B6 (operator-prepared, for owner submission)

> Operator-prepared text only. It authorizes nothing, and the operator will not open, merge, modify or close any pull request. The owner pastes this body after the authorization in `docs/B6_PR_AUTHORIZATION_SIGNED.md` exists.
>
> **Used on 2026-11-15.** Everything from `## Summary` onward was submitted as the body of pull request #237, whose title was `DEXYBOR Phase B B6 — model & inference abstraction`. The PR merged as `694f2f2`; the branch head at merge time was `1d5ff8d`, the conflict-resolution merge of `main` into the branch described in the reviewer notes.

**Title:** `DEXYBOR Phase B B6 — model & inference abstraction`

**Base:** `main` (`5365e3b`) ← **Head:** `codex/phase-b-b5-memory-system` (`b6b6966`)

---

## Summary

Phase B milestone **B6 only**. Adds a typed model/inference abstraction layer that is additive, offline, mock-by-default, and free of new dependencies.

- `lib/ai/chatModel.ts` — `ChatModel` contract (messages, structured output, tool calls, usage).
- `lib/ai/routingPolicy.ts` — per-task-class model routing with a deterministic fallback ladder that terminates safely at `mock`.
- `lib/ai/usageLedger.ts` — tenant-scoped usage metering (tokens, cost estimate, duration).
- `lib/ai/circuitBreaker.ts` — per-task budget ceiling and workspace daily ceiling; a breach returns `NEEDS_USER_INPUT` instead of runaway spend.
- `supabase/migrations/20261112000000_agent_usage_ledger_b6.sql` — one additive, append-only, tenant-scoped migration.
- Tests for all four modules, registered in the `package.json` `test` list (`b6b6966`).

## Commits

| Commit | Purpose |
|---|---|
| `8f3a3f5` | ChatModel contract |
| `4d1fb78` | routing policy + fallback ladder + model capabilities |
| `cff8d75` | usage ledger with tenant-scoped metering |
| `b0ec454` | circuit breaker with budget ceilings |
| `609ab7b` | `agent_usage_ledger_b6.sql` + migration-count test |
| `f712ef4` | docs count refresh |
| `8162b7b` | owner-record preservation + previously stray root files |
| `b6b6966` | registers the four B6 test files in the `test` runner and refreshes the documented count |

## Verification (run locally 2026-11-15 at `b6b6966`)

| Gate | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm test` | **952 pass, 0 fail** |
| `check:tracked-secrets` / `check:production-build` / `check:documented-count` | pass |
| `lint` | 0 errors (39 pre-existing warnings) |
| `typecheck` | clean |
| `build` | production build compiles, 44 routes |
| `npm run check` (full) | **exit 0** |

## Migration

`20261112000000_agent_usage_ledger_b6.sql` is new and additive; the 32 pre-existing migration files are byte-identical. **It has not been applied to any local, staging, or production database.**

## Safety posture

- `AI_PROVIDER=mock`; `WHATSAPP_OUTBOUND_ENABLED=false`; Phase B flags default off and hard-off in production.
- No production, hosted-DB, OAuth, provider, WhatsApp, calendar or browser call was made.
- WhatsApp ingest/outbound pipeline, auth, RLS, appointments and calendar gates are untouched.
- No new dependencies; no embeddings or `pgvector`.

## Out of scope

B7 (browser / computer-use), B8, B9. Each needs its own decision and explicit instruction. `OD-B4` (Playwright runtime browsers) is not decided.

## Reviewer notes

- Migration needs a separate owner decision before it is ever executed on a hosted project.
- B6 stays inactive until an owner-approved activation decision; nothing here flips a runtime flag.
- **Why B5 files appear in "Files changed".** B5 reached `main` as squash commits (`#235` `8662a48`), so the merge base is `8662a48` and the branch still carries the original B5 commits. `lib/agent/memory/*`, `supabase/migrations/20261109040000_memory_system_b5.sql`, `docs/PHASE_B_B5_DESIGN_NOTE.md`, `lib/agent/tools/permission*` and `scripts/verifyStagingOverlay.ts` are byte-identical to `main` — `git diff --stat origin/main HEAD -- lib/agent/memory …` is empty — so merging them changes nothing.
- **No dependency downgrade.** `package-lock.json` and `.github/workflows/ci.yml` differ between the branch and `main` only because `main` advanced (dependabot `#231`). The branch never modified them since the merge base (`git diff --stat 8662a48 HEAD -- package-lock.json .github/workflows/ci.yml` is empty), so the merge keeps `main`'s newer versions.
- `AI_PROVIDER` stays `mock` and the migration is not executed by any CI job in this PR.
- **Migration is additive and idempotent.** The file contains only `create table if not exists public.agent_usage_ledger`, `alter table … enable row level security`, a `drop policy if exists` + `create policy "Agent usage ledger is readable by workspace members"` pair, and two `create index if not exists`. There is no `drop table`, `delete`, `truncate` or column alteration, so the 32 pre-existing migrations are untouched.
- **B6 is dormant.** No production module imports `lib/ai/chatModel`, `routingPolicy`, `usageLedger` or `circuitBreaker` — only their own tests do. Merging changes no existing runtime path.

---

**Owner merge only.** The operator does not merge, close, or modify this PR.
