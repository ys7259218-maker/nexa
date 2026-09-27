# Staging pending appointment view — verified database-side filtering

Date: 2026-09-25. Staging-only Supabase project `vbizuxxgjlwqotuegskq`. No production change, actual booking, customer message or staging flag activation.

## Bug and fix

The earlier inbox read loaded 300 newest raw review requests and filtered decided entries in application code; when 300 newest were all decided, a genuine older pending request could not be shown. A PostgreSQL 17 `SECURITY INVOKER` view `public.pending_appointment_review_inbox` now filters decided rows via `NOT EXISTS` **before** the application applies the 30-row limit. The view reads both underlying RLS-protected tables as the authenticated caller, not as an owner/bypass-RLS view.

Staging-only SQL snapshot: `docs/staging-applied/20260925_pending_appointment_review_invoker_view.sql`. Applied directly via `execute_sql` after exact absence, PostgreSQL version and base-table RLS checks; **not recorded in canonical migration history**. Explicit grants: authenticated SELECT only, anon no access, authenticated no UPDATE/DELETE/INSERT. Missing view or DB errors must fail closed; never fall back to raw review queue.

## Rolled-back RLS and pending completeness proof

Created the invoker view inside a staging BEGIN/ROLLBACK transaction, inserted a synthetic conversation and 35 distinct synthetic inbound messages, then as an authenticated workspace owner created 35 reviews. The 34 newer reviews had human decisions while the oldest was undecided. SELECT of the invoker view returned exactly the older pending request. A different workspace owner and an empty JWT-subject actor both saw zero rows. After rollback, the view and all synthetic records were removed. Recreated the reviewed view in a separate atomic staging-only transaction.

Postflight: view has `security_invoker=true`, authenticated SELECT permitted, anonymous SELECT denied, authenticated UPDATE denied, review queue **0**, decisions **0**, matching synthetic messages **0**, matching synthetic conversations **0**. No production DB write or real customer interaction.

GitHub CI validates the repository adapter, unit contract and non-enabled runtime smoke, **not** a full signed-in staging HTTP flow. Real authenticated cookie-session staging tests and reviewed canonical migration/history reconciliation remain release gates. Do not blindly replay the experimental staging SQL on production.
