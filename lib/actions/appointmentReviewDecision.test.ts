import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordManualAppointmentDecision } from "./appointmentReviewDecision.ts";

const workspaceId = "123e4567-e89b-42d3-a456-426614174000";
const requestId = "123e4567-e89b-42d3-a456-426614174001";
const actorId = "123e4567-e89b-42d3-a456-426614174002";
type FixtureOptions = {
  signedIn?: boolean;
  member?: boolean;
  review?: boolean;
  insertError?: string;
  returnedActor?: string;
};
function fixture(opts: FixtureOptions = {}) {
  const queried: string[] = [];
  let inserts = 0;
  let inserted: Record<string, unknown> | null = null;
  const client = {
    auth: { async getUser() { return { data: { user: opts.signedIn === false ? null : { id: actorId } }, error: null }; } },
    from(table: string) {
      queried.push(table);
      const chain = {
        select(_fields: string) { return chain; },
        eq(_field: string, _value: unknown) { return chain; },
        in(_field: string, _value: unknown) { return chain; },
        insert(row: Record<string, unknown>) { inserts += 1; inserted = row; return chain; },
        async maybeSingle() {
          if (table === "workspace_members") {
            return { data: opts.member === false ? null : { role: "owner" }, error: null };
          }
          return { data: opts.review === false ? null : { id: requestId, workspace_id: workspaceId, status: "pending_review" }, error: null };
        },
        async single() {
          return { data: opts.insertError ? null : { ...inserted, actor_user_id: opts.returnedActor ?? actorId }, error: opts.insertError ? { code: opts.insertError } : null };
        },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, queried, get inserts() { return inserts; }, get inserted() { return inserted; } };
}
test("invalid decision and unauthenticated actor never read or write tenant data", async () => {
  const invalid = fixture();
  assert.deepEqual(await recordManualAppointmentDecision(invalid.client, { workspaceId, reviewRequestId: requestId, decision: "booked" }), { ok: false, error: "invalid_request" });
  assert.deepEqual(invalid.queried, []);
  const absent = fixture({ signedIn: false });
  assert.deepEqual(await recordManualAppointmentDecision(absent.client, { workspaceId, reviewRequestId: requestId, decision: "declined" }), { ok: false, error: "unauthenticated" });
  assert.equal(absent.inserts, 0);
});
test("viewer and nonexistent same-workspace review cannot decide", async () => {
  for (const opts of [{ member: false }, { review: false }]) {
    const f = fixture(opts);
    assert.deepEqual(await recordManualAppointmentDecision(f.client, { workspaceId, reviewRequestId: requestId, decision: "declined" }), { ok: false, error: "not_authorized" });
    assert.equal(f.inserts, 0);
  }
});
test("human manual-followup decision is actor-bound, immutable, and never books", async () => {
  const f = fixture();
  assert.deepEqual(await recordManualAppointmentDecision(f.client, { workspaceId, reviewRequestId: requestId, decision: "approved_for_manual_followup" }), { ok: true, decision: "approved_for_manual_followup", booked: false });
  assert.equal(f.inserts, 1);
  assert.deepEqual(f.inserted, { workspace_id: workspaceId, review_request_id: requestId, actor_user_id: actorId, decision: "approved_for_manual_followup" });
  assert.equal(f.queried.includes("appointments"), false);
});
test("unique conflict is terminal; never upsert or overwrite a competing decision", async () => {
  const f = fixture({ insertError: "23505" });
  assert.deepEqual(await recordManualAppointmentDecision(f.client, { workspaceId, reviewRequestId: requestId, decision: "declined" }), { ok: false, error: "already_decided" });
  assert.equal(f.inserts, 1);
});
test("tampered returned actor and unknown database errors fail closed", async () => {
  const forged = fixture({ returnedActor: requestId });
  assert.deepEqual(await recordManualAppointmentDecision(forged.client, { workspaceId, reviewRequestId: requestId, decision: "declined" }), { ok: false, error: "unavailable" });
  const unavailable = fixture({ insertError: "42501" });
  assert.deepEqual(await recordManualAppointmentDecision(unavailable.client, { workspaceId, reviewRequestId: requestId, decision: "declined" }), { ok: false, error: "unavailable" });
});
test("decision POST is staging-only, browser-origin checked, body-bounded and returns booked:false", () => {
  const route = readFileSync(new URL("../../app/api/appointment-reviews/decision/route.ts", import.meta.url), "utf8");
  assert.match(route, /canQueueAppointmentReview\(\{/);
  assert.match(route, /isSameOriginReviewRequest\(request\)/);
  assert.match(route, /readRequestTextWithLimit\(request, 1024\)/);
  assert.match(route, /recordManualAppointmentDecision\(client,/);
  assert.match(route, /result\.error === "already_decided" \? 409/);
  assert.match(route, /booked: false/);
  assert.doesNotMatch(route, /sendWhatsApp|from\(["']appointments["']\)|service.role/);
});
test("decision SQL is tenant scoped, insert/select only, and prevents double decisions", () => {
  const sql = readFileSync(new URL("../../docs/staging-appointment-human-decision-PROPOSAL.sql", import.meta.url), "utf8");
  assert.match(sql, /review_request_id uuid not null unique/);
  assert.match(sql, /actor_user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /r\.workspace_id=appointment_review_decisions\.workspace_id/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant select, insert on public\.appointment_review_decisions to authenticated/);
  assert.doesNotMatch(sql, /grant\s+[^;]*(?:update|delete)[^;]*to authenticated/);
});
