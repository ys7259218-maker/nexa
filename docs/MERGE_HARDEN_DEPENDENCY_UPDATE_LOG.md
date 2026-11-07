# DEXYBOR Stage F — Dependency Floor Update Log (Step 5)

**Date:** 2026-11-08 · **Branch:** `codex/merge-harden-integration` · **Base after merge:** `f5058ff`
**Authorization:** `docs/OD01_MINI_AUTHORIZATION_SIGNED.md` (R5/R6) + `docs/OD01_MINI_EXECUTION_INSTRUCTION_SIGNED.md` step 5 + `docs/MERGE_HARDEN_SECURITY_REMEDIATION.md` (MH-E floors).
**Rule:** only the 7 signed floors are applied; no `npm audit fix`, no `--force`, no unpinned upgrades.

---

## 1. Direct changes (exactly the signed floors)

| Package | Before | After | Form |
|---|---|---|---|
| `next` | `^16.3.2` (resolved 16.3.4) | `^16.4.1` (resolved **16.4.5**) | dependency floor |
| `@sentry/nextjs` | `10.74.0` | **`10.78.0`** | exact dependency floor |
| `sharp` | 0.35.4 | **0.35.5** | `overrides` |
| `source-map-js` | 1.2.1 | **1.2.2** | `overrides` |
| `fast-uri` | 3.1.6 | **3.1.9** | `overrides` |
| `zod` | 4.4.3 | **4.6.6** | `overrides` |
| `brace-expansion` | 1.1.18 / 5.0.9 | **1.1.21 / 5.0.12** | `overrides` (two ranges) |

`package.json` diff is limited to these lines plus the new `overrides` block. No other direct dependency, script, engine, or metadata changed.

## 2. Transitive movement (required by the authorized upgrades — not independently chosen)

Fresh `npm ls` / lockfile inspection shows every transitive major is demanded by the new authorized graph:

| Transitive | Before → After | Required by |
|---|---|---|
| `ajv-formats` | 2.1.1 → **3.0.1** | `schema-utils@4.8.3` (`^3.0.1`), pulled by `webpack@5.112.2` inside `@sentry/bundler-plugins@10.78.0` |
| `brace-expansion` | 1.1.18 → **1.1.21** · 5.0.9 → **5.0.12** | signed `overrides`; consumers `minimatch@3.1.5` / `minimatch@10.2.6` |
| `dotenv` | 16.6.1 → **17.4.2** | `@sentry/bundler-plugins@10.78.0` requires `^17.4.2` |
| `es-module-lexer` | 2.3.2 → **3.0.4** | `import-in-the-middle` (via `@sentry/node@10.78.0`) requires `^3.0.4`; webpack keeps its nested `^2.1.0` line |
| `@opentelemetry/*` | 2.12.0-era → 2.12.0/2.13.x | `@sentry/node@10.78.0` dependency graph |

No unauthorized direct major bump exists. The lockfile was regenerated only by `npm install --no-audit --no-fund` against the edited `package.json`; no `npm update`, no manual lock edit, no `npm audit fix`.

## 3. Lockfile size

`package-lock.json`: 386 insertions / 578 deletions · 78 changed-or-added package entries · 21 removed entries (dedupe/consolidation from the new Sentry graph).

## 4. Audit evidence (`npm audit --json`)

| Severity | Before | After |
|---|---|---|
| Critical | 2 | **0** |
| High | 4 | **0** |
| Moderate | 13 | 12 |
| Low | 0 | 0 |
| **Total** | **19** | **12** |

Raw JSON retained at `%TEMP%\opencode\stagef-audit-before.json` and `%TEMP%\opencode\stagef-audit-after.json`.

Remaining 12 moderates are the known build-tool chains (`glob`/`minimatch` via ESLint/Sentry tooling and the `typescript-eslint` chain); no critical/high remains and no signed floor covers them. They are documented, not silently fixed.

## 5. Install warnings (informational)

`npm warn allow-scripts` lists `unrs-resolver@1.12.2` and `@sentry/cli@2.58.6` install scripts as not yet allow-listed by the local npm policy. No script was approved or executed manually; the build step will prove whether the existing allow-list is sufficient. If `npm run check` fails on this, the run stops per signed rule.

---

**Status: `APPLIED — AWAITING FULL VERIFICATION (STEP 6)`**
