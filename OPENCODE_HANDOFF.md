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

1. Adopt Supabase's current Next.js SSR client pattern and protect dashboard routes server-side.
2. Consolidate the duplicate AI employee creation/list routes around one typed data layer.
3. Persist settings and load `/ai-employees/[id]` by authenticated owner.
4. Add unit tests for webhook signature/verification and integration tests for RLS-backed employee CRUD.
5. Design queued, idempotent WhatsApp event processing; keep outbound messaging feature-flagged until Meta registration is ready.
6. Add the AI provider behind a server-only interface after the data and authorization boundaries are stable.

Do not commit `.env.local` or any real secret. Run `npm run check` and inspect `git diff` before every handoff.
