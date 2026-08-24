# Nexa vision and safety contract

This document is a permanent development constraint for Nexa. Read it before making product, architecture, security, deployment, or integration changes.

## Product vision

Nexa is a trustworthy AI Business OS that helps an account owner configure AI employees, manage business communications, and automate work without losing control of customer data or business operations.

Development must continue from this repository. Preserve working behavior and the established dark, premium Nexa experience. Add real functionality incrementally, with honest empty/error states instead of fabricated data or misleading readiness indicators.

## Non-negotiable safety rules

- Never commit, display, transmit, or log real secrets, access tokens, private keys, webhook signatures, raw payloads, message bodies, or full customer phone numbers unless a narrowly scoped runtime operation strictly requires the data.
- Keep privileged credentials server-only. Never prefix secrets with `NEXT_PUBLIC_` and never expose the Supabase service-role key to browser code.
- Enforce ownership in the database with Supabase Row Level Security and independently protect sensitive pages on the server. Client-side hiding is not authorization.
- Use least privilege. Browser code uses only the anon/publishable key; privileged processors are isolated server-side and receive only the permissions they need.
- Fail closed for authentication, signatures, ownership, and outbound communication. Missing or invalid security configuration must not silently enable privileged behavior.
- Keep WhatsApp outbound disabled until Meta registration is complete and a controlled end-to-end test succeeds with a known-good number.
- Treat all external input as untrusted. Validate lengths, types, identifiers, webhook signatures, and provider responses before storing or using them.
- Preserve idempotency and deduplication for webhook processing so retries cannot create duplicate messages or actions.
- Do not weaken RLS, authentication, signature verification, secret handling, validation, tests, or feature flags merely to make a feature appear working.
- Do not invent business facts, prices, availability, bookings, metrics, or success states. AI replies must acknowledge missing information and hand off safely.
- Do not enable a new external provider or paid service without explicit configuration, privacy disclosure, bounded failure behavior, and tests.
- Before every handoff or deployment, run lint, typecheck, unit tests, production build, integration scaffolds, dependency audit, secret scan, and Git diff inspection.
- Keep migrations additive and documented. Back up production data before destructive schema work and provide a rollback plan.
- Keep GitHub history clean and never rewrite shared history or delete user data without explicit approval and a verified target.

## Security reality

No internet-connected product can honestly be guaranteed 100% unbreakable. Nexa therefore uses defence in depth: authentication, RLS, signed webhooks, input validation, least privilege, idempotency, feature flags, tests, audits, monitoring, backups, and documented recovery procedures. Security claims must remain accurate and evidence-based.

## Decision rule

If a proposed change conflicts with this contract or creates an unclear security/privacy impact, stop the change, preserve the safe current state, document the risk, and request an explicit decision from the owner.

