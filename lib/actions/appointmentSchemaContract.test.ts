import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../docs/appointment-review-queue-schema-PROPOSAL.sql", import.meta.url),
  "utf8",
);

test("appointment queue proposal remains isolated from bookings with atomic dedupe", () => {
  assert.match(sql, /create table public\.appointment_review_requests/i);
  assert.match(sql, /unique\s*\(workspace_id,inbound_message_id\)/i);
  assert.match(sql, /check\s*\(status = 'pending_review'\)/i);
  assert.match(sql, /references public\.messages\(id\)/i);
  assert.doesNotMatch(sql, /(?:insert\s+into|update|delete\s+from)\s+public\.appointments\b/i);
  assert.doesNotMatch(sql, /security definer/i);
});

test("proposed queue denies anonymous writes, requires authenticated workspace operator and inbound message", () => {
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.appointment_review_requests from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert on public\.appointment_review_requests to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+[^;]*\b(?:update|delete|all)\b[^;]*\bto authenticated/i);
  assert.match(sql, /for select to authenticated/i);
  assert.match(sql, /for insert to authenticated/i);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /public\.workspace_has_role\(workspace_id,array\['owner','admin','operator'\]::text\[\]\)/i);
  assert.match(sql, /m\.id = appointment_review_requests\.inbound_message_id/i);
  assert.match(sql, /m\.workspace_id = appointment_review_requests\.workspace_id/i);
  assert.match(sql, /m\.conversation_id = appointment_review_requests\.conversation_id/i);
  assert.match(sql, /m\.direction = 'inbound'/i);
  assert.match(sql, /c\.workspace_id = appointment_review_requests\.workspace_id/i);
});
