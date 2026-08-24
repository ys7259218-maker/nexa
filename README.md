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

Fill `.env.local` with your own project values. Never commit `.env.local`, a Supabase service-role key, Meta app secret, or WhatsApp access token. Run the SQL in `docs/SUPABASE_SETUP.md` (baseline plus the settings/dashboard and messaging migrations) in your project's SQL Editor before using the app.

In Supabase Authentication URL Configuration, set the production Site URL and allow `https://YOUR-DOMAIN/auth/callback` as a redirect URL. Add `http://localhost:3000/auth/callback` only for local development.

Open `http://localhost:3000`. Use `npm run check` before handing changes off or pushing them.

## What is connected

- Supabase authentication: `/login` and `/signup`, using cookie-based `@supabase/ssr` sessions; inputs are bounded and normalized, signup requires a 12-character password, provider errors stay private, and email-confirmation projects do not falsely redirect users into the app
- Secure account recovery: `/forgot-password` sends enumeration-safe recovery feedback, `/auth/callback` exchanges the one-time PKCE code with a fixed local redirect, and authenticated `/reset-password` updates the password then signs the recovery session out
- Server-side route protection: `proxy.ts` session refresh plus `requireAuthenticatedUser()` on `/dashboard`
- Typed AI employee data layer (`lib/aiEmployees.ts`): list/get/create/update/delete under RLS; powers `/dashboard/ai-employees/new`, the real record list at `/ai-employees`, and `/ai-employees/[id]` (load by ID, persist every settings and knowledge field, delete)
- Dashboard snapshot (`lib/dashboard.ts`): metrics, 7-day call chart, recent calls, upcoming appointments, and activity feed read from owner-scoped Supabase tables with loading, empty, error, and retry states
- Durable WhatsApp pipeline: signed webhook deduplicates inbound messages and delivery receipts in the `webhook_events` ledger, resolves the owning account via `whatsapp_channels`, stores conversations under RLS, updates delivered/read/failed statuses without regression, and drafts replies that are never sent while outbound stays feature-flagged
- Webhook abuse protection: raw WhatsApp payloads are capped at 1 MiB using both declared-length rejection and real streamed-byte counting before signature processing
- Fail-closed webhook recovery endpoint: `POST /api/internal/whatsapp/retry` requires a separate 32+ character server-only Bearer secret, processes at most 10 failed ledger rows per call, returns aggregate counts only, and stays disabled when unconfigured
- Owner-scoped conversation inbox at `/conversations`: newest chats, masked customer identifiers, message history, draft-blocked status, and loading/empty/error states; sidebar navigation is wired and the route is protected by both proxy and server auth
- AI provider interface with a safe deterministic mock plus an optional server-only OpenAI Responses API provider (`AI_PROVIDER=openai`, `OPENAI_API_KEY`, and explicit `OPENAI_MODEL`); requests use `store: false`, keys never enter client code, and incomplete configuration falls back to mock
- AI prompt-injection boundary: all business/customer fields are length-bounded and encoded as untrusted JSON; provider instructions forbid obeying embedded commands, exposing secrets, inventing facts, or claiming external actions occurred
- WhatsApp status UI on `/ai-employees/[id]`: webhook configured / inbound ready / outbound blocked by Meta, plus channel linking
- RLS integration test scaffolding: `npm run test:integration` (skipped without a dedicated test project)
- Honest public onboarding preview: business input is length-limited, remains in memory only, and ends at secure account creation instead of showing a fabricated ready employee or dashboard
- Onboarding, dashboard, employee management, voice, knowledge, phone, and deploy surfaces: UI prototype only unless stated above
- Firebase: environment-safe legacy client module, currently unused

## Setup and operations

- [Nexa vision and safety contract](docs/NEXA_VISION_AND_SAFETY.md)
- [Nexa master blueprint](docs/NEXA_MASTER_BLUEPRINT.md)
- [Supabase schema and RLS](docs/SUPABASE_SETUP.md)
- [WhatsApp integration and external blocker](docs/WHATSAPP.md)
- [OpenCode continuation handoff](OPENCODE_HANDOFF.md)
- [Current project recap](NEXA_PROJECT_RECAP.md)

## Security model

Browser clients may only use Supabase's anon/publishable key and must rely on Row Level Security. Privileged credentials are server-only. Sessions are stored in cookies via `@supabase/ssr` so both `proxy.ts` and server components can read them; the dashboard additionally validates the token with Supabase instead of trusting cookie presence. Incoming WhatsApp events are rejected unless their `x-hub-signature-256` matches the Meta app secret; verified events are processed by a server-only module that is the sole consumer of `SUPABASE_SERVICE_ROLE_KEY`, writing rows under the channel owner through idempotent ledger claims. Message bodies, tokens, secrets, signatures, raw payloads, and customer phone numbers are never logged. Outbound WhatsApp sending remains disabled behind `WHATSAPP_OUTBOUND_ENABLED=false`.

Login and signup display generic user-safe failures instead of returning Supabase internals. Email addresses are normalized and bounded, passwords are bounded, and signup enforces a minimum 12-character password. When Supabase requires email confirmation, signup shows an honest confirmation state and does not navigate to a protected page without a session.

Every route receives clickjacking, MIME-sniffing, HTTPS, referrer, opener, permissions, and baseline CSP protections from `next.config.ts`. API routes additionally return `Cache-Control: no-store`. The CSP intentionally avoids a broad script directive until a nonce-based Next.js policy is implemented, so security headers do not break framework hydration.
