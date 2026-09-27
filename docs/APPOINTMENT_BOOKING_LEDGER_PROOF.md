# Appointment booking ledger contract — staging rollback proof

Date: 2026-09-25. Proposal only; no permanent staging or production schema change.

A BEGIN/ROLLBACK staging transaction created the proposed `appointment_booking_approvals` and `appointment_booking_attempts` tables, enabled RLS, applied explicit grants/policies, and used synthetic conversation/message/review/decision data.

Verified:
- workspace owner could create an explicit booking approval only after a separate inbound customer-confirmation message and existing `approved_for_manual_followup` review decision;
- a different workspace owner saw zero approval rows;
- authenticated browser role could not INSERT directly into `appointment_booking_attempts`;
- all DDL and synthetic rows rolled back.

The booking-attempt table is intentionally read-only to authenticated clients. Future writes require a server-only privileged adapter that independently validates authenticated user/workspace and the approval chain before calling the provider-safe booking executor.

This does **not** constitute a real booking, calendar integration, migration, or production release.
