import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAppointmentReviewDecisions } from "./appointmentReviewHistory.ts";

const workspaceId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174001";
function fixture(options: { signedIn?: boolean; member?: boolean; data?: unknown[]; readError?: boolean } = {}) {
  const queries: Array<{ table: string; fields: Array<[string, unknown]> }> = [];
  const client = {
    auth: { async getUser() { return { data: { user: options.signedIn === false ? null : { id: userId } }, error: null }; } },
    from(table: string) {
      const q = { table, fields: [] as Array<[string, unknown]> };
      queries.push(q);
      const chain = {
        select(_fields: string) { return chain; },
        eq(field: string, value: unknown) { q.fields.push([field, value]); return chain; },
        in(field: string, roles: unknown) { q.fields.push([field, roles]); return chain; },
        order(field: string, order: unknown) { q.fields.push(["order:" + field, order]); return chain; },
        async maybeSingle() { return { data: options.member === false ? null : { role: "operator" }, error: null }; },
        async limit(n: number) { q.fields.push(["limit", n]); return { data: options.data ?? [], error: options.readError ? { code: "db_error" } : null }; },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, queries };
}
test("invalid workspace and absent user are denied before DB reads", async () => {
  const invalid = fixture();
  assert.deepEqual(await listAppointmentReviewDecisions(invalid.client, "invalid"), { ok: false, error: "invalid_workspace" });
  assert.equal(invalid.queries.length, 0);
  const absent = fixture({ signedIn: false });
  assert.deepEqual(await listAppointmentReviewDecisions(absent.client, workspaceId), { ok: false, error: "unauthenticated" });
  assert.equal(absent.queries.length, 0);
});
test("viewer is denied before decision history read", async () => {
  const f = fixture({ member: false });
  assert.deepEqual(await listAppointmentReviewDecisions(f.client, workspaceId), { ok: false, error: "not_authorized" });
  assert.equal(f.queries.some(q => q.table === "appointment_review_decisions"), false);
});
test("authorized human decision history is bounded and tenant scoped", async () => {
  const f = fixture();
  assert.deepEqual(await listAppointmentReviewDecisions(f.client, workspaceId), { ok: true, items: [] });
  const query = f.queries.find(q => q.table === "appointment_review_decisions");
  assert.ok(query?.fields.some(([field, value]) => field === "workspace_id" && value === workspaceId));
  assert.ok(query?.fields.some(([field, value]) => field === "limit" && value === 30));
});
test("history rejects foreign-workspace or invalid decision rows even with a faulty privileged client", async () => {
  for (const data of [
    [{ workspace_id: userId, decision: "declined" }],
    [{ workspace_id: workspaceId, decision: "booked" }],
  ]) {
    const f = fixture({ data });
    assert.deepEqual(await listAppointmentReviewDecisions(f.client, workspaceId), { ok: false, error: "unavailable" });
  }
});
test("history database errors fail closed", async () => {
  const f = fixture({ readError: true });
  assert.deepEqual(await listAppointmentReviewDecisions(f.client, workspaceId), { ok: false, error: "unavailable" });
});
test("review page distinguishes manual decisions from real bookings", () => {
  const page = readFileSync(new URL("../../app/appointment-reviews/page.tsx", import.meta.url), "utf8");
  assert.match(page, /listAppointmentReviewDecisions\(client, workspace\.data\.id\)/);
  assert.match(page, /Marked for manual follow-up — not booked/);
  assert.match(page, /Decision history is unavailable/);
  assert.doesNotMatch(page, /sendWhatsApp|createBooking|from\(["']appointments["']\)/);
});
