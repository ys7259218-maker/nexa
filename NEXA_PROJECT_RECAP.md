# Nexa project recap

## Current state

The repository is an early Next.js 16 App Router application, not a finished production SaaS. Its visual flows are valuable and have been preserved. Authentication and one AI employee create page use Supabase; most other dashboard data and configuration controls are static/demo UI.

### Routes

| Route | State |
| --- | --- |
| `/` | In-memory onboarding flow, then dashboard UI |
| `/login`, `/signup` | Supabase Auth when environment values are configured |
| `/dashboard` | Static dashboard plus signed-in email/logout |
| `/dashboard/ai-employees/new` | Inserts into `ai_employees` through Supabase |
| `/ai-employees` | Separate demo form/list; not persisted |
| `/ai-employees/[id]` | Static settings UI; route id is not loaded yet |
| `/api/whatsapp/webhook` | Meta verification and signature validation; no event processing yet |

## Stabilization completed

- Removed hardcoded cloud client configuration from active source and added `.env.example` placeholders.
- Made missing optional configuration fail safely instead of breaking the production build.
- Added a signed WhatsApp webhook boundary without requiring a registered phone number for local development.
- Marked WhatsApp registration and production deployment honestly as pending instead of showing ready.
- Fixed lint failures and added `typecheck`/`check` scripts.
- Added setup, Supabase RLS, WhatsApp blocker, security, and OpenCode handoff documentation.

## Important limitations

- There is no AI model/provider call or agent runtime yet.
- AI settings, knowledge base, voice, phone, WhatsApp settings, and deploy actions are UI-only.
- Dashboard metrics and the `/ai-employees` list are sample data.
- Route protection is client-level only; server-side auth/middleware should be added with the chosen Supabase SSR approach.
- The onboarding record is local browser storage only.
- Automated application tests have not yet been established; lint, TypeScript, and production build are the current gates.

## Credential note

Earlier Git history contained browser configuration values. They were moved out of active source. Although Firebase browser keys and Supabase anon/publishable keys are designed for public clients, their permissions still depend on provider restrictions and Supabase RLS. Review restrictions and rotate/revoke any credential if it was ever treated as private. Do not rewrite shared history without coordinating first.
