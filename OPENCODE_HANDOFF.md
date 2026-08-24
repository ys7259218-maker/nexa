# OpenCode handoff

Continue from this repository; do not scaffold a replacement project.

```bash
git clone https://github.com/ys7259218-maker/nexa.git
cd nexa
npm ci
copy .env.example .env.local
npm run check
```

Read `NEXA_PROJECT_RECAP.md`, `README.md`, `docs/SUPABASE_SETUP.md`, and `docs/WHATSAPP.md` before editing. Preserve the current UI while replacing demo surfaces incrementally.

Recommended next slice:

1. Done: Supabase Next.js SSR client pattern, `proxy.ts` session refresh, and server-side `requireAuthenticatedUser()` gates on `/dashboard`, `/dashboard/ai-employees/new`, `/ai-employees`, and `/ai-employees/[id]`.
2. Done: Consolidated create/list flows around the typed data layer in `lib/aiEmployees.ts` (list/get/create/update/delete under RLS); `/ai-employees` lists real records and `/ai-employees/[id]` loads by route ID with all settings cards persisting (department, greeting, timezone, working hours, accent, speaking style/speed/tone, country, business hours, call forwarding/routing, knowledge metadata).
3. Done: Dashboard reads owner-scoped `calls`, `appointments`, and `activity_events` through `getDashboardSnapshot` (`lib/dashboard.ts`) with loading/empty/error/retry states. Run the migration in `docs/SUPABASE_SETUP.md` before deploying — the app requires those tables and columns.
4. Build the runtimes that populate the new tables: a telephony/booking pipeline for `calls`/`appointments`, and queued idempotent WhatsApp webhook processing writing `activity_events` with category `whatsapp`. Outbound sending stays feature-flagged until Meta registration is ready.
5. Add the AI provider behind a server-only interface after the data and authorization boundaries are stable.
6. Run RLS integration tests against a dedicated Supabase project (`npm run test:integration`; see `tests/integration/README.md`) to validate the policies end to end.

Do not commit `.env.local` or any real secret. Run `npm run check` (lint, typecheck, tests, build) plus `npm audit` and inspect `git diff` before every handoff.
