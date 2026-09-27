import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../server/appointmentBookingStore.ts", import.meta.url),
  "utf8",
);

test("trusted loader is server-only and derives booking facts from authenticated DB records", () => {
  assert.match(source, /^import "server-only";/);
  assert.match(source, /actorClient\.auth\.getUser\(\)/);
  assert.match(source, /\.in\("role", \["owner", "admin"\]\)/);
  assert.match(source, /\.from\("appointment_booking_approvals"\)/);
  assert.match(source, /\.from\("appointment_review_requests"\)/);
  assert.match(source, /\.from\("appointment_review_decisions"\)/);
  assert.match(source, /\.from\("messages"\)/);
  assert.match(source, /customerConfirmedAt: confirmation\.created_at/);
  assert.match(source, /humanApprovedAt: approval\.approved_at/);
  assert.doesNotMatch(source, /requestedAt: input\./);
  assert.doesNotMatch(source, /customerRequest: input\./);
});

test("trusted loader requires distinct same-conversation inbound confirmation after the original request", () => {
  assert.match(source, /\.eq\("conversation_id", review\.conversation_id\)/);
  assert.match(source, /\.eq\("direction", "inbound"\)/);
  assert.match(source, /confirmation\.id === review\.inbound_message_id/);
  assert.match(source, /Date\.parse\(confirmation\.created_at\) < Date\.parse\(review\.created_at\)/);
  assert.match(source, /\.eq\("decision", "approved_for_manual_followup"\)/);
});

test("ledger claim is unique, conflict-checked and only failed attempts can be reacquired", () => {
  assert.match(source, /\.from\("appointment_booking_attempts"\)[\s\S]*\.insert\(row\)/);
  assert.match(source, /inserted\.error\?\.code !== "23505"/);
  assert.match(source, /stored\.booking_approval_id !== bookingApprovalId/);
  assert.match(source, /stored\.idempotency_key !== input\.idempotencyKey/);
  assert.match(source, /if \(stored\.status === "claimed"\) return \{ status: "in_progress" \}/);
  assert.match(source, /\.eq\("status", "failed"\)/);
});

test("ledger completion and failure release are scoped to the exact claimed authorization", () => {
  for (const field of ["workspace_id", "review_request_id", "booking_approval_id", "idempotency_key"]) {
    assert.match(source, new RegExp("\\.eq\\(\\\"" + field + "\\\"" ));
  }
  assert.match(source, /status: "confirmed"/);
  assert.match(source, /status: "failed"/);
  assert.match(source, /\.eq\("status", "claimed"\)/);
  assert.doesNotMatch(source, /sendWhatsApp|sendTextMessage|createAppointment\(/);
});
