# Dashboard Accessibility Refresh V1

## Scope

A focused accessibility slice across the dashboard and AI employee list:

- **DashboardHeader sign-out** now prevents duplicate submits, keeps the button
  pending (`Signing out…`, disabled, `aria-busy`), only redirects after a real
  successful `signOut`, and surfaces genuine failures through the shared
  `SettingsFeedback` alert region instead of claiming success.
- **AppointmentsTable, RecentCalls, RecentActivity** are wrapped in named
  `<section aria-labelledby="...">` landmarks, expose `ul`/`li` record
  semantics, `role="status"` empty states, and keep decorative icons hidden
  from assistive technology.
- **Dashboard error retry** is a live `alert` region with a transition-backed
  pending/disabled/`aria-busy` button that reads `Retrying…` while in flight.
- **AIEmployeeCard** no longer declares `"use client"` (it uses no client
  hooks), navigates with a semantic Next `Link` (focus-visible ring preserved)
  instead of client-only `router.push`, and its readiness meter is a labeled
  `role="progressbar"`.

## Safety boundary

- No notification/search behavior, routing, data queries, metric values, empty
  values, database, environment, or production configuration changed.
- `WHATSAPP_OUTBOUND_ENABLED` is untouched and remains `false`.
- No visual styling was removed; focus-visible treatment was added or aligned.

## Verification

`lib/uiContracts.test.ts` protects the sign-out failure/pending semantics and
honest null-supabase fallback, the named `<section>` landmarks with
`aria-labelledby`, `ul`/`li` sections and `role="status"` empty states, the
transition-backed live retry control, and the Link/progressbar/no-`"use client"`
contract on employee cards.