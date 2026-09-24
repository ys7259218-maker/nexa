import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listPendingAppointmentReviews, REVIEW_INBOX_LIMIT } from "./appointmentReviewInbox.ts";

const workspaceId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174009";
const pending = (id: string, workspace = workspaceId) => ({
  id, workspace_id: workspace, status: "pending_review",
});
type Options = {
  authenticated?: boolean; member?: boolean; rows?: unknown[];
  membershipError?: boolean; readError?: boolean;
};
function fixture(options: Options = {}) {
  const queries: Array<{ table: string; fields: Array<[string, unknown]> }> = [];
  const client = {
    auth: { async getUser() {
      return { data: { user: options.authenticated === false ? null : { id: userId } }, error: null };
    } },
    from(table: string) {
      const q = { table, fields: [] as Array<[string, unknown]> };
      queries.push(q);
      const chain = {
        select(value: string) { q.fields.push(["select", value]); return chain; },
        eq(field: string, value: unknown) { q.fields.push([field, value]); return chain; },
        in(field: string, value: unknown) { q.fields.push([field, value]); return chain; },
        order(field: string, value: unknown) { q.fields.push(["order:" + field, value]); return chain; },
        async maybeSingle() {
          return { data: options.member === false ? null : { role: "operator" },
            error: options.membershipError ? { code: "unknown" } : null };
        },
        async limit(n: number) {
          q.fields.push(["limit", n]);
          return { data: options.rows ?? [], error: options.readError ? { code: "unknown" } : null };
        },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, queries };
}
test("invalid workspace is rejected before auth or tenant read", async () => {
  const f = fixture();
  assert.deepEqual(await listPendingAppointmentReviews(f.client, "invalid"), { ok: false, error: "invalid_workspace" });
  assert.equal(f.queries.length, 0);
});
test("missing session is rejected before tenant read", async () => {
  const f = fixture({ authenticated: false });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unauthenticated" });
  assert.equal(f.queries.length, 0);
});
test("viewers and nonmembers cannot read pending view", async () => {
  const f = fixture({ member: false });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "not_authorized" });
  assert.equal(f.queries.some(q => q.table === "pending_appointment_review_inbox"), false);
  assert.ok(f.queries[0].fields.some(([field, roles]) => field === "role" && Array.isArray(roles) && !roles.includes("viewer")));
});
test("membership query errors fail closed before pending view read", async () => {
  const f = fixture({ membershipError: true });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unavailable" });
  assert.equal(f.queries.length, 1);
});
test("authorized empty inbox queries pending-only view with tenant boundary and limit 30", async () => {
  const f = fixture();
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: true, items: [] });
  const query = f.queries.find(q => q.table === "pending_appointment_review_inbox");
  assert.ok(query);
  assert.ok(query.fields.some(([field, value]) => field === "workspace_id" && value === workspaceId));
  assert.ok(query.fields.some(([field, value]) => field === "limit" && value === REVIEW_INBOX_LIMIT));
  assert.ok(query.fields.some(([field]) => field === "order:created_at"));
  assert.equal(f.queries.some(q => q.table === "appointment_review_requests" || q.table === "appointment_review_decisions"), false);
});
test("unexpected foreign-workspace rows from a privileged client fail closed", async () => {
  const f = fixture({ rows: [pending(userId, userId)] });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unavailable" });
});
test("unexpected non-pending status from faulty view fails closed", async () => {
  const f = fixture({ rows: [{ ...pending(userId), status: "declined" }] });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unavailable" });
});
test("missing view and database errors return unavailable, never query the raw queue", async () => {
  const f = fixture({ readError: true });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unavailable" });
  assert.equal(f.queries.some(q => q.table === "appointment_review_requests"), false);
});
test("database-side filtering avoids the old 300-decided-requests scan cap", async () => {
  const row = pending(userId);
  const f = fixture({ rows: [row] });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: true, items: [row] });
  assert.equal(f.queries.some(q => q.fields.some(([field, value]) => field === "limit" && value === 300)), false);
});
test("GET endpoint delegates to tenant-scoped view reader without booking", () => {
  const route = readFileSync(new URL("../../app/api/appointment-reviews/route.ts", import.meta.url), "utf8");
  assert.match(route, /listPendingAppointmentReviews\(supabase, workspaceId\)/);
  assert.match(route, /items: result\.items, booked: false/);
});
test("staging review page shows explicit human decision controls, not confirmed booking", () => {
  const page = readFileSync(new URL("../../app/appointment-reviews/page.tsx", import.meta.url), "utf8");
  assert.match(page, /listPendingAppointmentReviews\(client, workspace\.data\.id\)/);
  assert.match(page, /not confirmed appointments/);
  assert.match(page, /AppointmentReviewDecisionButtons workspaceId=\{item\.workspace_id\} reviewRequestId=\{item\.id\}/);
});
test("decision UI requires acknowledgement and never calls booking or outbound providers", () => {
  const buttons = readFileSync(new URL("../../components/appointments/AppointmentReviewDecisionButtons.tsx", import.meta.url), "utf8");
  assert.match(buttons, /type="checkbox" checked=\{acknowledged\}/);
  assert.match(buttons, /disabled=\{!acknowledged \|\| busy\}/);
  assert.match(buttons, /approved_for_manual_followup/);
  assert.match(buttons, /credentials: "same-origin"/);
  assert.match(buttons, /result\.booked !== false/);
  assert.doesNotMatch(buttons, /sendWhatsApp|createBooking|from\(["']appointments["']\)/);
});
