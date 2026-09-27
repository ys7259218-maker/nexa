# Staging booking-schema reconcile — live evidence

Date: 2026-09-25. Read-only verification against the real staging project
`vbizuxxgjlwqotuegskq` using dedicated staging accounts. No DDL, booking,
outbound send, real customer data or production access.

## Commands run (with local `.env.local` staging credentials injected)

```
npm run test:integration:appointments   # existing read-only real-Auth harness
npm run test:integration:booking-reconcile   # new read-only booking-schema reconcile
```

Requirement: `INTEGRATION_SUPABASE_URL` must equal `https://vbizuxxgjlwqotuegskq.supabase.co`;
the harnesses fail closed if credentials point anywhere else.

## Results (both passed against live staging)

- The dedicated staging test accounts authenticate; `appointment_review_requests`,
  `appointment_review_decisions` and `pending_appointment_review_inbox`
  are **present and readable** (empty on staging, no real data).
- The proposal-only booking ledger tables `appointment_booking_approvals` and
  `appointment_booking_attempts` **do not exist** on staging; direct SELECT and
  INSERT to them return PostgREST errors (fail closed).
- Conclusion: the booking schema from `docs/schema-proposals/appointment_booking_ledger_v1.sql`
  is still **not applied** to staging; the review-queue stack is applied. The
  server-only booking adapter therefore cannot operate on staging until the
  ledger schema is intentionally and reversibly applied — no booking is live.

## Limitations

- This is authenticated PostgREST read-only evidence, not an execute_sql
  privilege check and not an end-to-end server-only adapter run (the adapter
  needs the absent ledger tables).
- CI runs these scripts without credentials: both tests report **skipped**
  (guards pass), so a green CI is not staging evidence.