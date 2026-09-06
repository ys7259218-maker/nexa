import assert from "node:assert/strict";
import test from "node:test";
import { auditActionLabel, auditEventDetail, listEmployeeAuditEvents, listWorkspaceAuditEvents } from "./auditEvents.ts";

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

test("workspace audit listing bounds rows and supports entity-type filter", async () => {
  const row = { id: "2", entity_type: "message", entity_id: null, action: "outbound_message_sent", metadata: { template_name: "order_confirmed" }, created_at: "2026-01-02" };
  assert.deepEqual(await listWorkspaceAuditEvents(client({ data: [row], error: null }), { entityType: "message" }), { data: [row], error: null });
  assert.deepEqual(await listWorkspaceAuditEvents(client({ data: null, error: { message: "private" } }), {}), { data: [], error: "Could not load audit history." });
  assert.deepEqual(await listWorkspaceAuditEvents(client({ data: [], error: null }), { limit: 101 }), { data: [], error: "Invalid audit history request." });
});

test("audit labels remain safe for unknown actions", () => {
  assert.equal(auditActionLabel("automation_paused"), "Emergency pause engaged");
  assert.equal(auditActionLabel("employee_version_restored"), "Settings version restored");
  assert.equal(auditActionLabel("knowledge_entry_created"), "Knowledge entry created");
  assert.equal(auditActionLabel("outbound_message_sent"), "Message sent");
  assert.equal(auditActionLabel("unexpected"), "Safety setting changed");
});

test("audit event detail maps transitions and stateless actions", () => {
  assert.equal(auditEventDetail({ action: "lifecycle_changed", metadata: { from_status: "Draft", to_status: "Active" } }), "Draft → Active");
  assert.equal(auditEventDetail({ action: "lifecycle_changed", metadata: { from_status: "Paused", to_status: "Paused" } }), "Now Paused");
  assert.equal(auditEventDetail({ action: "lifecycle_changed", metadata: { from_status: "Active" } }), "Now Active");
  assert.equal(auditEventDetail({ action: "automation_paused", metadata: {} }), "Automation is paused until explicitly resumed.");
  assert.equal(auditEventDetail({ action: "automation_resumed", metadata: {} }), "Automation is running again.");
  assert.equal(auditEventDetail({ action: "knowledge_entry_deleted", metadata: {} }), "Knowledge entry was removed.");
  assert.equal(auditEventDetail({ action: "outbound_message_sent", metadata: { template_name: "order_confirmed", wa_message_id: "wamid.1" } }), 'A human-approved outbound message was sent via template "order_confirmed" (wamid.1).');
  assert.equal(auditEventDetail({ action: "outbound_message_sent", metadata: {} }), "A human-approved outbound message was sent via free-form text.");
  assert.equal(auditEventDetail({ action: "unknown_event", metadata: {} }), "No status transition.");
});
