# Appointment booking DB adapter

Date: 2026-09-25. Code-only, unmerged. Depends on the proposal-only booking approval/ledger schema from PR #213.

## Trusted authorization loader

`loadTrustedBookingAuthorization` accepts only workspace and booking-approval IDs from the caller. It authenticates the user with the actor's RLS-scoped Supabase session, requires owner/admin membership, then reloads the approval, review request, manual-followup decision and distinct inbound customer-confirmation message from the database. Requested time, customer request text, customer-confirmation time and human-approval identity/time are derived from stored records, never browser/model fields.

## Server-only booking ledger adapter

`createAppointmentBookingLedger` uses a server-only privileged Supabase client. Initial claim uses a unique insert. Duplicate conflicts are reloaded and classified as confirmed replay, in-progress, conflict or a retryable failed attempt. Failed attempts may be atomically reacquired only while status is `failed`. Completion and failure release are scoped by workspace, review request, approval ID, idempotency key and current `claimed` status.

The module does not call a calendar provider, send WhatsApp messages, expose service-role credentials, or create a runtime endpoint. The service-role adapter must only be invoked after the actor-scoped loader succeeds.

Four contract tests lock the authorization and exact-claim boundaries. Real DB adapter behavior still requires the proposal schema to be applied in an isolated staging test and exercised with synthetic authenticated accounts before a provider can be connected.
