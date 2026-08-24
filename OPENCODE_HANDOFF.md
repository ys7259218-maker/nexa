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
2. Consolidate the duplicate AI employee creation/list routes around one typed data layer.
3. Persist settings and load `/ai-employees/[id]` by authenticated owner.
4. Add integration tests for RLS-backed employee CRUD (unit tests already cover webhook signatures and proxy routing).
5. Design queued, idempotent WhatsApp event processing; keep outbound messaging feature-flagged until Meta registration is ready.
6. Add the AI provider behind a server-only interface after the data and authorization boundaries are stable.

Do not commit `.env.local` or any real secret. Run `npm run check` (lint, typecheck, tests, build) plus `npm audit` and inspect `git diff` before every handoff.
