# DEXYBOR AI — MERGE & HARDEN: SECURITY REMEDIATION (PROPOSAL — NOTHING APPLIED)

**Report ID:** MH-E · **Stage:** E · **Date:** 2026-11-07
**Repo:** `C:\Users\ys725\OneDrive\Documents\Default Project\nexa` · HEAD `8c70be6`
**Fresh evidence:** `npm audit --json` (exit 1, 25,432 B, saved `Temp\opencode\mh-audit-20261107.json`) + `npm ls next @sentry/nextjs zod sharp fast-uri source-map-js brace-expansion` + package.json/next.config inspection + targeted source greps.
**Rule compliance:** no dependency file was modified; `npm audit fix` and `npm audit fix --force` were **not** run; nothing "believed" — every claim below is from the fresh run.

---

## 1. Fresh counts (before = after, since nothing was applied)

| Severity | Count | Families |
|---|---|---|
| Critical | 2 | next, @sentry/nextjs |
| High | 5 | brace-expansion, fast-uri, sharp, source-map-js, zod |
| Moderate | 12 | glob/minimatch/@sentry build-plugin chain, typescript-eslint chain |
| **Total** | **19** | (Phase A baseline was also 2C/5H/12M — same totals, fresh re-run confirms) |

## 2. Fresh installed versions (`npm ls`)

next **16.3.4** · @sentry/nextjs **10.74.0** · zod **4.4.3** · sharp **0.35.4** · fast-uri **3.1.6** · source-map-js **1.2.1** · brace-expansion **1.1.18** (via eslint/minimatch@3.1.5) **and 5.0.9** (via minimatch@10.2.6 → @typescript-eslint/glob@13.0.6 chain) · glob 13.0.6 · typescript-eslint 8.65.0.

## 3. Priority 1 — Criticals

### 3.1 next 16.3.4 (11 advisories; `fixAvailable=true` inside current range)
Advisory subsets by fixed-version floor (from fresh `via` ranges):
- fixed by **16.3.8**: use-cache draft-mode leak, SSG/ISR cache poisoning (both variants), dev-server MCP disclosure, metadata dynamicParams disclosure, `'use cache'` root-param leak.
- fixed by **16.4.1** (range `<=16.4.0`): unauthenticated RCE in Image-optimization API when SVGs processed; DoS in App Router Server-Actions; plus `next/og` ImageResponse RCE fixed at 16.3.6.
- **Effective target: `next >= 16.4.1`** (16.3.8 alone leaves the two `<=16.4.0` advisories open).

Reachability (fresh code inspection, not package-name assumption):
| Advisory | Reachable in this app? |
|---|---|
| next/og ImageResponse RCE | **NO** — zero `next/og`/`ImageResponse` imports (app+lib grep, 2026-11-07) |
| `use cache` leaks (both) / typed-array RCE | **NO** — no `use cache` usage found |
| dev MCP disclosure | dev-server only; not a runtime surface |
| metadata dynamicParams disclosure | App Router verification pages use dynamic params — treat surface conservatively; fixed by same bump |
| SSG/ISR cache poisoning | App is largely dynamic + `no-store` API headers; self-host exposure low but bump still required |
| Image-optimization RCE / SSRF | optimizer is Next-internal (sharp 0.35.4 transitive under next); app passes no remote-image config (`next.config.ts` has no `images.remotePatterns`); **still fixed only by the next bump** |
| Server-Actions DoS | Server actions exist in the repo — **applicable**; fixed by 16.4.1 |

### 3.2 @sentry/nextjs 10.74.0 (fixed `10.78.0`, semver-minor)
Middleware-bypass-via-tunnel advisory via `@sentry/bundler-plugin-core/(plugins)` chain. Fresh facts: `next.config.ts` uses `withSentryConfig(..., { sourcemaps: { disable: true }, telemetry: false, silent: true })`, **no `tunnelRoute` configured**; Sentry runtime is dormant (no DSN values configured in the environment; guards keep placeholder/unsafe DSNs disabled — `sentryMonitoring.test.ts` fresh PASS). Exposure: dormant; **bump to 10.78.0 still required** (package.json pins exact `10.74.0`, so an authorized bump edits dependency + lockfile).

## 4. Priority 2 — Highs

| Package (installed) | Fixed by | Direct/transitive & path | Reachability | Proposal |
|---|---|---|---|---|
| fast-uri 3.1.6 | **≥3.1.9** (advisories span `>=3.0.0 <3.1.9`) | transitive: webpack/ajv, ajv-formats (@sentry plugins) | build-time chain; serialize/host-confusion bugs require attacker-controlled URI processing that the app itself does not perform (first-party code never imports fast-uri) | Authorized bump to ≥3.1.9; **#220's 3.1.8 is no longer the sufficient target** but stays a valid starting point from origin/main |
| sharp 0.35.4 (librsvg CVE-2026-96889) | ≥0.35.5 | transitive under next (image optimizer internals) | reachable only if the optimizer rasterizes an SVG attacker input; app exposes `/api/*` webhook routes only; conservative: patch | Allow next bump (may update sharp) or an explicit sharp override to ≥0.35.5 |
| source-map-js 1.2.1 | ≥1.2.2 | transitive (postcss/tailwindcss build chain) | build-time; event-loop DoS via hostile source maps — none introduced by first-party code | bump via lockfile during the same authorized cycle |
| brace-expansion 1.1.18 & 5.0.9 | ≥1.1.21 / ≥5.0.12 for the 2026 DoS pairs | transitive (eslint/minimatch 3.1.5; ts-eslint/minimatch 10.2.6) | dev/build glob expansion only | bump via dependents/overrides in the same cycle |
| zod 4.4.3 (oversized-collection memory exhaustion) | ≥4.6.6 | **dev-toolchain-only** in this tree: zero `zod` imports in `app/**` or `lib/**` first-party code (fresh grep); zod arrives via eslint-config-next → eslint-plugin-react-hooks → zod-validation-error | **not reachable from app runtime** | bump with the eslint-config-next sync (or override); not urgent for runtime |

## 5. Priority 3 — Moderates (toolchain, no runtime exposure)

`glob@13.0.6` (AbortSignal traversal) → sentry bundler chain — build-time; `minimatch@10.2.6` (`>=7 <11.0.1`) via typescript-eslint glob chain — dev/build only (npm's suggested "fix" for this family, eslint-config-next 15.5.29, would **downgrade** the eslint config alongside a next bump; do **not** follow it mechanically — prefer bumping the eslint-config to the next-16-aligned latest and re-auditing); `@sentry/bundler-plugin-core`/`bundler-plugins` moderates resolve with the 10.78.0 sentry bump; `typescript-eslint@8.x` chain moderates — dev-only echo of the minimatch advisory. These are acceptable as toolchain residual risk **with owner acknowledgment**, or zero-cost ride-along bumps during the authorized dependency cycle.

## 6. Remediation plan (to execute only with dependency authorization)

| Step | Action | Compatibility reasoning | Rollback |
|---|---|---|---|
| 1 | `package.json`: next `^16.3.2` → `^16.4.1` (within-range minor) | satisfies all next advisory floors (16.3.8 + two ≤16.4.0) without a major jump; renderer/API conventions unchanged for this app (no `use cache`, no next/og, no image remotePatterns) | `git restore package.json package-lock.json` + `npm ci` |
| 2 | `@sentry/nextjs` 10.74.0 → **10.78.0** (exact pin) | server-required fix for the critical; minor-in-major-10; config API unchanged | same |
| 3 | lockfile refresh so transitive graph yields fast-uri ≥3.1.9, sharp ≥0.35.5, source-map-js ≥1.2.2, brace-expansion ≥1.1.21/≥5.0.12, zod ≥4.6.6, minimatch ≥11.0.1 where chains allow | use `npm update <pkg>`/overrides, never `audit fix` | same |
| 4 | Full verification: `npm test`, typecheck, lint, guards, issue reports, fresh build, re-run `npm audit --json`, lockfile diff review | Phase-A-derived protocol | restore + re-verify |
| 5 | Record before/after audit JSONs + diff of advisory set | reproducibility | — |

**Current applied state = before state. Counts before and after: identical 2C/5H/12M (19)** because no change was authorized or made.
