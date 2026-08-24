# Nexa project recap

## Current state

The repository is an early Next.js 16 App Router application, not a finished production SaaS. Its visual flows are valuable and have been preserved. Authentication and one AI employee create page use Supabase; most other dashboard data and configuration controls are static/demo UI.

### Routes

| Route | State |
| --- | --- |
| `/` | In-memory onboarding flow, then dashboard UI |
| `/login`, `/signup` | Supabase Auth when environment values are configured; signed-in visitors are redirected to `/dashboard` |
| `/dashboard` | Server-side auth gate plus signed-in email/logout; metrics are sample data |
| `/dashboard/ai-employees/new` | Server-side auth gate; inserts into `ai_employees` through Supabase |
| `/ai-employees` | Server-side auth gate around the demo form/list; not persisted |
| `/ai-employees/[id]` | Server-side auth gate around static settings UI; route id is not loaded yet |
| `/api/whatsapp/webhook` | Meta verification and signature validation; no event processing yet |

All four app surfaces under `/dashboard` and `/ai-employees` are protected twice: `proxy.ts` refreshes sessions and redirects unauthenticated requests to `/login`, and each server page independently calls `requireAuthenticatedUser()`.

## Stabilization completed

- Removed hardcoded cloud client configuration from active source and added `.env.example` placeholders.
- Made missing optional configuration fail safely instead of breaking the production build.
- Added a signed WhatsApp webhook boundary without requiring a registered phone number for local development.
- Marked WhatsApp registration and production deployment honestly as pending instead of showing ready.
- Fixed lint failures and added `typecheck`/`check` scripts.
- Added setup, Supabase RLS, WhatsApp blocker, security, and OpenCode handoff documentation.

## Stabilization completed (SSR slice)

- Adopted the `@supabase/ssr` cookie-based client pattern (`lib/supabase/client.ts`, `lib/supabase/server.ts`) and removed the legacy localStorage singleton.
- Added `proxy.ts` (Next.js 16 proxy, formerly middleware) to refresh sessions and optimistically redirect unauthenticated visits away from `/dashboard` and `/ai-employees`.
- `/dashboard` verifies the session server-side via `requireAuthenticatedUser()` in `lib/auth.ts` and passes the signed-in email into the existing UI.

## Stabilization completed (route protection slice)

- Extended server-side `requireAuthenticatedUser()` gates to `/dashboard/ai-employees/new`, `/ai-employees`, and `/ai-employees/[id]`; the create form moved verbatim into `components/ai/NewAIEmployeeForm.tsx` with no visual changes.
- Authenticated visitors to `/login` and `/signup` are redirected to `/dashboard`; unauthenticated visits to protected routes go to `/login`.
- Extracted redirect decisions into `lib/proxyRouting.ts` with 7 unit tests alongside the existing webhook tests (9 total); `npm audit` reports no vulnerabilities.

## Important limitations

- There is no AI model/provider call or agent runtime yet.
- AI settings, knowledge base, voice, phone, WhatsApp settings, and deploy actions are UI-only.
- Dashboard metrics and the `/ai-employees` list are sample data.
- `/ai-employees` and `/ai-employees/[id]` are gated demo surfaces; they render sample data and do not read or persist records yet.
- The onboarding record is local browser storage only.
- Unit tests cover webhook signatures and proxy routing decisions; RLS-backed CRUD integration tests are not established yet.

## Credential note

Earlier Git history contained browser configuration values. They were moved out of active source. Although Firebase browser keys and Supabase anon/publishable keys are designed for public clients, their permissions still depend on provider restrictions and Supabase RLS. Review restrictions and rotate/revoke any credential if it was ever treated as private. Do not rewrite shared history without coordinating first.
