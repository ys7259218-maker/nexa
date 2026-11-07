# Phase A — Security & Dependency Audit (Task A4)

**Audit date:** 2026-11-07 · **Mode:** metadata-level audit. `npm audit --json` (networked metadata query, read-only); no lockfile mutation; no values of `.env.local` read; no secrets printed. Raw JSON retained at `Temp\opencode\phase-a\npm-audit.json` (UTF-16 as written by PowerShell `*>`); decoded summary `npm-audit-summary.txt`.

## 1. Inventory

| Element | Version / state |
| --- | --- |
| Lockfile | `package-lock.json` lockfileVersion **3**; unchanged in working tree (clean vs HEAD) |
| next | package.json pin `^16.3.2` → **installed 16.3.4**; `AGENTS.md` confirms this repo targets the current, breaking-changes Next line |
| @sentry/nextjs | direct dependency, pinned `10.74.0` (audit wants ≥ 10.78.0) |
| zod (transitive) | installed `4.4.3` (vulnerable range `<4.6.6`) |
| sharp (transitive) | installed `0.35.4` (vulnerable range `<0.35.5`) |
| eslint-config-next | direct dev `^16.3.2` → installed `16.3.4`; drags an older typescript-eslint eslave pin per audit ranges |
| Supabase CLI dev dep | pinned `2.117.0` (aligned by test contract `supabaseLocalGate.test.ts`) |
| Playwright | dev `1.63.0` |

## 2. `npm audit --json` result — **19 findings: 2 critical, 5 high, 12 moderate** (exit code 1)

Critical / high findings with installed-version hit-check and reachability classification:

| Severity | Package (installed) | Advisory | Reachability in THIS app | Classification |
| --- | --- | --- | --- | --- |
| CRITICAL | `next` 16.3.4 (range 16.0.0–16.4.0) | GHSA-vcvr-r3jv-pc5j RCE in `next/og` ImageResponse | `next/og`/`ImageResponse` **not used** (source grep: 0 uses) | High impact if reachable; **not reachable via app code** — upgrade still required for defense-in-depth and other listed next fixes |
| CRITICAL | `next` 16.3.4 | GHSA-2464-fhr4-w9xw Unauthenticated RCE in Image Optimization API when SVG used; GHSA-cjq9-62q9-8jv4 SSRF in Image Optimization; GHSA-mcj8-r9mp-w47p / GHSA-4jqv-mc3x-m676 cache poisoning SSG/ISR; GHSA-p3m5-59mp-jv5r App Router Server-Action DoS; GHSA-3w37-wq28-93x7 / GHSA-h694-7cp9-m8p3 / GHSA-673q-mjm6-r5xr `use cache` leaks/RCE; GHSA-f87g-xv8r-7p7x metadata image routes dynamicParams bypass; GHSA-39w2-rjm5-chcv dev-server MCP information disclosure | `"use cache"` / `draftMode` not used; metadata image routes not used; **`next/image` IS used** (`components/ui/Avatar.tsx`) → image-optimization APIs are on by default; **Server Actions are used extensively** (`lib/actions/*`) → DoS applicable. On Vercel, image optimization happens on the platform etc. — private/self-host risk profile differs | **Upgrade decision required (owner):** in-range patched release availability noted by audit (`fixAvailable=true`); self-host posture should re-check each advisory |
| CRITICAL | `@sentry/nextjs` 10.74.0 (fixed 10.78.0) | GHSA-mchm-gjx6-7h55 Middleware Bypass when using Tunnel route | **No tunnel route configured**; Sentry is disabled-by-default (structurally safe DSN handling; `sourcemaps.disable`, telemetry off in `next.config.ts`) | Low practical exposure today; **still upgrade to ≥10.78.0 before any DSN activation** |
| HIGH | `zod` 4.4.3 (<4.6.6) | GHSA-mrhx-c7xc-m3w5 memory exhaustion validating oversized constrained collections | App validates bounded request bodies first (`lib/requestBody.ts` byte limits) before zod parsing on API routes; server-action inputs parse with zod | Medium (DoS-class); upgrade inside next dependency patch cycle |
| HIGH | `sharp` 0.35.4 (<0.35.5) | GHSA-wq5f-xc86-pv6w librsvg CVE-2026-96889 | Remote SVG optimization surface limited (Avatar uses local assets) | Medium; patch available via minor bump |
| HIGH | `source-map-js` 1.2.1 | GHSA-68fv-2mgg-jv7q event-loop DoS via source-map offsets | Build-time + dev tools only (sourcemaps disabled for upload) | Low runtime |
| HIGH | `fast-uri` 3.1.6 (via @supabase/*) | 7 advisories (authority injection, scheme spoofing …) | Used inside Supabase client URL handling — inputs are owner-configed env URLs, bounded | Medium; **already patched on `origin/main` (`5aaff15 fix(deps): update fast-uri to patched 3.1.8`)** — merges into the reconcile plan |
| HIGH | `brace-expansion` 1.1.18 (+4.x copy) | 3 CPU/stack-exhaustion DoS advisories | Build/dev-time glob evaluation only | Low runtime |
| MODERATE (12) | glob 13.0.6 (via Sentry), minimatch nested versions, `@typescript-eslint/*` 8.65.0, `eslint-config-next` 16.3.4 pulling older ranges | assorted DoS/dev-chain advisories | dev toolchain | Dev-only; no production runtime exposure |

Counts reconcile exactly with the earlier same-day plain `npm audit` (19 total; 2 critical: `@sentry/nextjs` + `next`).

## 3. npm script-based security checks (fresh)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check:tracked-secrets` | 0 | "Tracked-secret guard passed. No secrets found in tracked files." Guard itself is exercised by `lib/trackedSecretGuard.test.ts` (含水 PKCS#8 detection cases) |
| Guard reachability | — | `.env*` git-ignored except `.env.example`; `.env.local` never read during audit; placeholder patterns in `.env.example` are allow-listed by design |

## 4. Non-dependency security posture spot-checks (read-only)

- Security headers in `next.config.ts` (nosniff, DENY frames, strict referrer, COOP, Permissions-Policy, CSP base-uri/form-action/frame-ancestors/object-src, HSTS): present and tested by `lib/securityHeaders.test.ts`.
- Production-build guard remains: `PRODUCTION_RELEASE_APPROVED` exact-signal requirement + staging `vbizuxxgjlwqotuegskq` ref rejection — tested by `lib/productionGuard.test.ts`; retains `WHATSAPP_OUTBOUND_ENABLED=false` requirement regardless of approval.
- `check:production-build` (item in Task A1 earlier runs) passed: probe exit 0 (thoretically no values printed).
- Calendar OAuth key handling: AES-256-GCM + service-role-only writes (see calendar review) — no secrets surfaced in evidence.

## 5. What was NOT done in Phase A

- `npm audit fix` / `npm audit fix --force` — **not run** (would mutate `package-lock.json`; owner-approved maintenance cycle, plus lockfile-regeneration depends on network + hydration environment).
- No manual dependency upgade, no lockfile edit, no install (`npm ci/clean`).
- No production or hosted-service interactions beyond the metadata-requested `npm audit`.

## 6. Recommended (owner-decision) security follow-up order

1. Reconcile with `origin/main` (brings `#220` fast-uri patch + `#217` docs + #218/#215 features) — the fastest verified fix path.
2. Owner-approved minor/patch cycle: `next` (critical bundle), `@sentry/nextjs` ≥10.78.0, `zod` ≥4.6.6, `sharp` ≥0.35.5 — then re-run `npm test` + `npm audit` and the fresh-build verification.
3. Verify no regression to the 667-test baseline; production build gate is unchanged by these bumps.
4. Defer anything touching Supabase CLI pins to `deps-minor-patch-v1`-style review (pinned 2.117.0 with a contract test).

**No secret values were printed or persisted**; audits list names/ranges/effects only.
