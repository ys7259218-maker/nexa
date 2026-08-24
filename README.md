# Nexa AI

Nexa is an early-stage Next.js application for onboarding a business, managing AI employees, and connecting communication channels. The current repository contains a working UI prototype, Supabase email/password authentication, a Supabase-backed AI employee creation screen, and a secured WhatsApp webhook boundary.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/ys7259218-maker/nexa.git
cd nexa
npm ci
copy .env.example .env.local
npm run dev
```

Fill `.env.local` with your own project values. Never commit `.env.local`, a Supabase service-role key, Meta app secret, or WhatsApp access token.

Open `http://localhost:3000`. Use `npm run check` before handing changes off or pushing them.

## What is connected

- Supabase authentication: `/login` and `/signup`, using cookie-based `@supabase/ssr` sessions
- Server-side route protection: `proxy.ts` session refresh plus `requireAuthenticatedUser()` on `/dashboard`
- Supabase AI employee insert: `/dashboard/ai-employees/new`
- Meta webhook verification and signed-event acknowledgement: `/api/whatsapp/webhook`
- Onboarding, dashboard, employee management, voice, knowledge, phone, and deploy surfaces: UI prototype only unless stated above
- Firebase: environment-safe legacy client module, currently unused

## Setup and operations

- [Supabase schema and RLS](docs/SUPABASE_SETUP.md)
- [WhatsApp integration and external blocker](docs/WHATSAPP.md)
- [OpenCode continuation handoff](OPENCODE_HANDOFF.md)
- [Current project recap](NEXA_PROJECT_RECAP.md)

## Security model

Browser clients may only use Supabase's anon/publishable key and must rely on Row Level Security. Privileged credentials are server-only. Sessions are stored in cookies via `@supabase/ssr` so both `proxy.ts` and server components can read them; the dashboard additionally validates the token with Supabase instead of trusting cookie presence. Incoming WhatsApp events are rejected unless their `x-hub-signature-256` matches the Meta app secret. The handler acknowledges verified events but intentionally does not process them until durable storage and idempotency are designed.
