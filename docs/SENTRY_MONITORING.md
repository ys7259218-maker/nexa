# Privacy-safe error monitoring

Nexa includes an optional Sentry error-monitoring foundation. It is disabled when
`NEXT_PUBLIC_SENTRY_DSN` is empty or invalid, which is the required default.

## Current safety boundary

- Error reporting only; performance tracing and session replay are off.
- Cookies, headers, request/response bodies, query parameters, user details,
  database values, stack variables, GraphQL data, and generative-AI inputs and
  outputs are explicitly excluded.
- Sentry build telemetry and source-map upload are off. `SENTRY_AUTH_TOKEN` is
  reserved for a later, separately approved rollout and must never be committed.
- No Sentry account, project, DSN, release, test event, or production deployment
  is created by this code-only slice.

## Later owner-approved activation

1. Create a Sentry Next.js project and copy its public DSN.
2. Add `NEXT_PUBLIC_SENTRY_DSN` to the selected Vercel environment only.
3. Deploy a preview, trigger a non-sensitive synthetic error, and verify that one
   event arrives without request, user, customer, message, or AI content.
4. Keep source maps disabled until a separate review approves the server-only
   organization, project, and token configuration.

Activation is not evidence that authenticated flows, Supabase RLS, migrations, or
WhatsApp delivery work. Those remain separate release gates.
