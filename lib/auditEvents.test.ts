import assert from "node:assert/strict";
import test from "node:test";
import { auditActionLabel, listEmployeeAuditEvents } from "./auditEvents.ts";

function client(result: { data: unknown[] | null; error: null | { message: string } }) {
  const builder = { select: () => builder, eq: () => builder, order: () => builder, limit: async () => result };
  return { from: () => builder } as never;
}

test("audit history returns bounded rows and sanitizes query errors", async () => {
  const row = { id: "1", entity_type: "ai_employee", entity_id: "employee-1", action: "automation_paused", metadata: {}, created_at: "2026-01-01" };
  assert.deepEqual(await listEmployeeAuditEvents(client({ data: [row], error: null }), "employee-1"), { data: [row], error: null });
  assert.deepEqual(await listEmployeeAuditEvents(client({ data: null, error: { message: "private" } }), "employee-1"), { data: [], error: "Could not load audit history." });
  assert.deepEqual(await listEmployeeAuditEvents(client({ data: [], error: null }), "", 100), { data: [], error: "Invalid audit history request." });
});

test("audit labels remain safe for unknown actions", () => {
  assert.equal(auditActionLabel("automation_paused"), "Emergency pause engaged");
  assert.equal(auditActionLabel("employee_version_restored"), "Settings version restored");
  assert.equal(auditActionLabel("unexpected"), "Safety setting changed");
});
