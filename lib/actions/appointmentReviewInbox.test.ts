import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listPendingAppointmentReviews, REVIEW_INBOX_LIMIT } from "./appointmentReviewInbox.ts";

const workspaceId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174009";
type Options = { authenticated?: boolean; member?: boolean; rows?: unknown[]; membershipError?: boolean; readError?: boolean; decidedIds?: string[]; decisionError?: boolean };
function fixture(options: Options = {}) {
  const queries: Array<{ table: string; fields: Array<[string, unknown]> }> = [];
  const client = {
    auth: { async getUser() { return { data: { user: options.authenticated === false ? null : { id: userId } }, error: null }; } },
    from(table: string) {
      const q = { table, fields: [] as Array<[string, unknown]> };
      queries.push(q);
      const chain = {
        select(value: string) { q.fields.push(["select", value]); return chain; },
        eq(field: string, value: unknown) { q.fields.push([field, value]); return chain; },
        in(field: string, value: unknown) { q.fields.push([field, value]); return chain; },
        order(field: string, value: unknown) { q.fields.push(["order:" + field, value]); return chain; },
        async maybeSingle() { return { data: options.member === false ? null : { role: "operator" }, error: options.membershipError ? { code: "unknown" } : null }; },
        async limit(n: number) { q.fields.push(["limit", n]); return { data: options.rows ?? [], error: options.readError ? { code: "unknown" } : null }; },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({
            data: (options.decidedIds ?? []).map(review_request_id => ({ review_request_id })),
            error: options.decisionError ? { code: "unknown" } : null,
          }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, queries };
}
test("invalid workspace and absent session do not query tenant data", async () => {
  const invalid = fixture();
  assert.deepEqual(await listPendingAppointmentReviews(invalid.client, "invalid"), { ok: false, error: "invalid_workspace" });
  assert.equal(invalid.queries.length, 0);
  const noSession = fixture({ authenticated: false });
  assert.deepEqual(await listPendingAppointmentReviews(noSession.client, workspaceId), { ok: false, error: "unauthenticated" });
  assert.equal(noSession.queries.length, 0);
});
test("viewers and nonmembers are denied before any review queue read", async () => {
  const f = fixture({ member: false });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "not_authorized" });
  assert.equal(f.queries.some(q => q.table === "appointment_review_requests"), false);
  assert.ok(f.queries[0].fields.some(([field, roles]) => field === "role" && Array.isArray(roles) && !roles.includes("viewer")));
});
test("authorized empty inbox is explicitly bounded and workspace scoped", async () => {
  const f = fixture();
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: true, items: [] });
  const query = f.queries.find(q => q.table === "appointment_review_requests");
  assert.ok(query);
  assert.ok(query.fields.some(([field, value]) => field === "workspace_id" && value === workspaceId));
  assert.ok(query.fields.some(([field, value]) => field === "status" && value === "pending_review"));
  assert.ok(query.fields.some(([field, value]) => field === "limit" && value === REVIEW_INBOX_LIMIT));
  assert.ok(query.fields.some(([field, value]) => field === "order:created_at"));
});
test("even a privileged or faulty repository cannot return foreign-workspace reviews", async () => {
  const f = fixture({ rows: [{ workspace_id: "123e4567-e89b-42d3-a456-426614174010", status: "pending_review" }] });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unavailable" });
});
test("database failures fail closed and do not reveal customer requests", async () => {
  const f = fixture({ readError: true });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unavailable" });
});
test("GET route requires gate, one workspace ID, authenticated RLS client and never books", () => {
  const route = readFileSync(new URL("../../app/api/appointment-reviews/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.match(route, /url\.searchParams\.getAll\("workspaceId"\)\.length !== 1/);
  assert.match(route, /listPendingAppointmentReviews\(supabase, workspaceId\)/);
  assert.match(route, /items: result\.items, booked: false/);
});

test("staging review page only exposes explicit human decisions, never a confirmed booking", () => {
  const page = readFileSync(new URL("../../app/appointment-reviews/page.tsx", import.meta.url), "utf8");
  assert.match(page, /canQueueAppointmentReview\(\{/);
  assert.match(page, /requireAuthenticatedUser\(\)/);
  assert.match(page, /listPendingAppointmentReviews\(client, workspace\.data\.id\)/);
  assert.match(page, /not confirmed appointments/);
  assert.match(page, /AppointmentReviewDecisionButtons workspaceId=\{item\.workspace_id\} reviewRequestId=\{item\.id\}/);
  assert.doesNotMatch(page, /sendWhatsApp|from\(["\x27]appointments["\x27]\)|\.insert\(|\.update\(/);
});

test("pending inbox hides already-decided requests without leaking other workspace rows", async () => {
  const row = { id: "123e4567-e89b-42d3-a456-426614174005", workspace_id: workspaceId, status: "pending_review" };
  const f = fixture({ rows: [row], decidedIds: [row.id] });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: true, items: [] });
  const decisionQuery = f.queries.find(q => q.table === "appointment_review_decisions");
  assert.ok(decisionQuery);
  assert.ok(decisionQuery.fields.some(([field, value]) => field === "workspace_id" && value === workspaceId));
  assert.ok(decisionQuery.fields.some(([field, value]) => field === "review_request_id" && Array.isArray(value) && value.includes(row.id)));
});
test("decision-ledger read failure denies the inbox instead of showing decided requests", async () => {
  const row = { id: "123e4567-e89b-42d3-a456-426614174005", workspace_id: workspaceId, status: "pending_review" };
  const f = fixture({ rows: [row], decisionError: true });
  assert.deepEqual(await listPendingAppointmentReviews(f.client, workspaceId), { ok: false, error: "unavailable" });
});

test("human decision UI requires acknowledgement and never calls booking or outbound providers", () => {
  const buttons = readFileSync(new URL("../../components/appointments/AppointmentReviewDecisionButtons.tsx", import.meta.url), "utf8");
  assert.match(buttons, /type="checkbox" checked=\{acknowledged\}/);
  assert.match(buttons, /disabled=\{!acknowledged \|\| busy\}/);
  assert.match(buttons, /approved_for_manual_followup/);
  assert.match(buttons, /declined/);
  assert.match(buttons, /credentials: "same-origin"/);
  assert.match(buttons, /result\.booked !== false/);
  assert.doesNotMatch(buttons, /sendWhatsApp|createBooking|from\(["']appointments["']\)/);
});
