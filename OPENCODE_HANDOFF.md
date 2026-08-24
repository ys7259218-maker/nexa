# OpenCode handoff

Continue from this repository; do not scaffold a replacement project.

```bash
git clone https://github.com/ys7259218-maker/nexa.git
cd nexa
npm ci
copy .env.example .env.local
npm run check
```

Read `docs/NEXA_VISION_AND_SAFETY.md`, `NEXA_PROJECT_RECAP.md`, `README.md`, `docs/SUPABASE_SETUP.md`, and `docs/WHATSAPP.md` before editing. The vision and safety contract is non-negotiable. Preserve the current UI while replacing demo surfaces incrementally.

Recommended next slice:

1. Done: Supabase Next.js SSR client pattern, `proxy.ts` session refresh, and server-side `requireAuthenticatedUser()` gates on `/dashboard`, `/dashboard/ai-employees/new`, `/ai-employees`, and `/ai-employees/[id]`.
2. Done: Consolidated create/list flows around the typed data layer in `lib/aiEmployees.ts` (list/get/create/update/delete under RLS); `/ai-employees` lists real records and `/ai-employees/[id]` loads by route ID with all settings cards persisting (department, greeting, timezone, working hours, accent, speaking style/speed/tone, country, business hours, call forwarding/routing, knowledge metadata).
3. Done: Dashboard reads owner-scoped `calls`, `appointments`, and `activity_events` through `getDashboardSnapshot` (`lib/dashboard.ts`) with loading/empty/error/retry states.
4. Done: Durable, idempotent WhatsApp inbound processing behind the signed webhook (`lib/whatsappIngest.ts` + server-only `lib/server/whatsappProcessor.ts`). Meta events deduplicate on immutable message IDs via the `webhook_events` ledger, resolve owners through `whatsapp_channels`, store conversations/messages under RLS, and draft replies through `lib/ai/provider.ts` (safe mock; no real API key). Outbound sending stays feature-flagged (`WHATSAPP_OUTBOUND_ENABLED=false`) until Meta registration clears. Run BOTH migrations in `docs/SUPABASE_SETUP.md` before deploying — settings/dashboard AND messaging tables are required.
5. Done: Real conversation inbox at `/conversations` reads owner-scoped `conversations`/`messages`, masks customer identifiers in the list/header, shows inbound history and blocked AI drafts, and includes loading/empty/error states. The route is protected by both `proxy.ts` and `requireAuthenticatedUser()`.
6. Implement real outbound sending behind the feature flag after Meta registration, plus a controlled end-to-end test with one known-good number.
7. Done: Optional OpenAI Responses API provider is behind the same interface and selected only in `lib/server/aiProvider.ts`. It requires explicit `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`, sends `store: false`, sanitizes failures, and keeps mock as the safe default/fallback. Never log message bodies or customer numbers.
8. Done: Meta delivered/read/failed receipts deduplicate through the ledger and update only the owner&apos;s matching outbound message without status regression. A fail-closed, fixed-batch recovery route at `POST /api/internal/whatsapp/retry` wraps `retryPendingWebhookEvents` behind a separate 32+ character Bearer secret. Next consider moving inline webhook work to a queue/worker using the same processor boundary.
9. Done: Global Next.js security headers block framing and object embedding, prevent MIME sniffing, enforce long-lived HTTPS, restrict referrer/browser capabilities, isolate opener context, and set a non-breaking baseline CSP. All `/api/*` responses are `no-store`; configuration tests prevent accidental removal.
10. Done: WhatsApp webhook request bodies are capped at 1 MiB with both declared-length fast rejection and actual streamed-byte enforcement. Oversized requests receive `413` before signature processing, protecting server memory without changing valid Meta webhook behavior.
11. Done: The public onboarding is explicitly a non-persistent preview. It caps business text at 1,000 characters, keeps answers in memory only, removes the unused local-storage persistence path, and hands off to secure signup instead of claiming a real employee is ready or rendering a fabricated dashboard.
12. Done: OpenAI inputs are bounded, structured as untrusted JSON, and paired with explicit prompt-injection/action-claim/secret-exfiltration guardrails. Webhook claim failures log only a generic message, never event IDs or database error details.
13. Run RLS integration tests against a dedicated Supabase project (`npm run test:integration`; see `tests/integration/README.md`) to validate all policies end to end.

Do not commit `.env.local` or any real secret. Run `npm run check` (lint, typecheck, tests, build) plus `npm audit` and inspect `git diff` before every handoff. Never log message bodies, access tokens, app secrets, signatures, raw payloads, or end-customer phone numbers.
