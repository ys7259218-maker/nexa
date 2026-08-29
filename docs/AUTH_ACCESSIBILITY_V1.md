# Authentication accessibility baseline v1

Status: implemented for the public email/password authentication forms; broader assistive-technology audit remains.

## Included

- Login, signup, password recovery, and password reset fields keep explicit visible labels instead of relying on placeholder text.
- Dynamic errors use assertive atomic announcements; success feedback uses polite atomic announcements.
- Newly rendered submission feedback receives programmatic focus without changing the user's field values.
- Forms and submit buttons expose pending state with `aria-busy`; disabled buttons keep an honest progress label and a disabled cursor.
- Login and signup cards fit narrow screens while retaining the established Nexa visual identity.

This slice changes no authentication rules, Supabase calls, redirects, session behavior, provider configuration, database schema, deployment, feature flag, or external system. It does not claim WCAG conformance or completion of screen-reader, zoom, contrast, touch-target, cognitive, or browser/device testing.

## Verification

- `lib/uiContracts.test.ts` statically protects visible labels, busy-state semantics, and focused live feedback across all four forms.
- The existing authentication validation and redirect tests continue to protect input and redirect boundaries.
- The local browser smoke suite continues to cover login, signup, recovery, and the unauthenticated protected-route boundary.
