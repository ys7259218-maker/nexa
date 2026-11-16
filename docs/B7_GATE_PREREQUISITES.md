# B7 GATE PREREQUISITES — operator readiness report

> Operator-authored status report. It authorizes nothing and records no owner decision. Every owner field below stays blank until the owner fills it personally.

**Prepared:** 2026-11-16
**Repository state:** `main` @ `f6694d2` (`docs: pin the B6 merge commit and document hash line endings (#239)`)
**Gate result:** B7 **can not start**. Three owner instruments are missing. No B7 code, browser binary, dependency, migration or external call exists.

---

## 1. Verified facts (read-only checks, 2026-11-16)

| Fact | Evidence | Result |
|---|---|---|
| B6 merged | `git log --oneline -1` | `f6694d2`, PR #239 on top of the B6 merge `694f2f2` |
| No browser runtime in the codebase | search for `chromium`, `browserType`, `.launch(` under `lib/agent/` | no matches |
| Playwright packages present but no browsers | `node_modules/{playwright,playwright-core,@playwright/test}`, `%LOCALAPPDATA%\ms-playwright` | packages present; browser cache **absent** |
| No browser/e2e npm script | `package.json` scripts filtered on `browser|playwright|e2e` | no matches |
| Tool risk tiers today | `lib/agent/tools/types.ts` | `T0`, `T1` only — T4 does not exist yet |
| Planner already understands T0–T5 | `lib/agent/planner/plannerStore.ts` validation | T0–T5 accepted |
| Migration chain | `supabase/migrations/*.sql` | 33 tracked `.sql` + `README.md`; newest `20261112000000_agent_usage_ledger_b6.sql` |
| Unit-test gate | `npm run check` at `f6694d2` | 952 pass / 0 fail, exit 0 |

---

## 2. What B7 needs before its first commit

| # | Instrument | Where the owner acts | Current state |
|---|---|---|---|
| 1 | **OD-B10** — computer-use stays deferred, B7 is browser-only | `docs/DEXYBOR_OD_B1_B12_OWNER_DECISION_MATRIX.md`, section "OD-B10" owner box | `PENDING OWNER DECISION` |
| 2 | **OD-B4** — Playwright runtime browsers + hosting, staged A→B | same matrix, section "OD-B4" owner box | `PENDING OWNER DECISION` |
| 3 | **B7 execution instruction** — scope, files, tests, stop conditions | `docs/B7_EXECUTION_INSTRUCTION_DRAFT.md` → owner copies to `docs/B7_EXECUTION_INSTRUCTION_SIGNED.md`, fills Sections A/B and ticks the C/E rows, signs Section L | `DRAFT — NOT SIGNED` |
| 4 | **B7 push/PR authorization** | prepared by the operator only after a B7 branch exists | `NOT PREPARED` |

B7 needs **1 + 2 + 3** before any code. Item 4 is needed only at push time, exactly as the B6 PR authorization worked.

---

## 3. What OD-B4 is choosing (summary only — no decision made here)

| Option | Shape | Trade-off |
|---|---|---|
| A | Playwright browsers installed on the worker host; one ephemeral process per session | Uses tooling already in the repo; simplest start; host image/upgrade burden |
| B | Containerized browser service, one container per session | Harder isolation boundary; more ops; recommended before real-tenant beta |
| C | External browser-API vendor | Third-party egress and trust boundary; not recommended now |

The matrix recommends **staged A→B**: A for closed internal testing with the T4 flag off, B before any real-tenant beta; C deferred.

## 4. What OD-B10 is choosing (summary only)

Confirm computer-use stays deferred and B7 ships **browser only**. The tool-manifest family stays reserved and unregistered; enabling it later needs a separate owner decision and authorization.

---

## 5. Operator commitment at this gate

- No B7 source file, test, migration, dependency, browser download or external call until items 1–3 are signed.
- No owner name, date, signature, initials or decision is typed by the operator, now or later.
- The existing WhatsApp pipeline, provider settings, production guards and flags stay untouched.
- If the owner signs, the operator prepares a B7 branch and a small B7 push/PR authorization draft, and still waits for that signature before pushing or merging.

**Status:** `B7 GATE OPEN — 3 OWNER INSTRUMENTS MISSING — NO B7 WORK PERFORMED`
