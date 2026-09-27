import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("booking ledger schema keeps approval explicit and booking writes server-only", () => {
  const sql = readFileSync(
    new URL("../../docs/schema-proposals/appointment_booking_ledger_v1.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create table public\.appointment_booking_approvals/);
  assert.match(sql, /customer_confirmation_message_id uuid not null unique/);
  assert.match(sql, /d\.decision = 'approved_for_manual_followup'/);
  assert.match(sql, /m\.id <> r\.inbound_message_id/);
  assert.match(sql, /workspace_has_role\(appointment_booking_approvals\.workspace_id, array\['owner','admin'\]\)/);
  assert.match(sql, /create table public\.appointment_booking_attempts/);
  assert.match(sql, /idempotency_key text not null unique/);
  assert.match(sql, /alter table public\.appointment_booking_attempts enable row level security/);
  assert.match(sql, /grant select on public\.appointment_booking_attempts to authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*(insert|update|delete)[^;]*appointment_booking_attempts[^;]*authenticated/i);
  assert.doesNotMatch(sql, /security definer/i);
});
