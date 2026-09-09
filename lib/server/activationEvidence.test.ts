import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeActivationVerification,
  classifyEvidence,
  verifyActivationEvidence,
  type ActivationEvidenceInsert,
  type EvidenceWriter,
} from "./activationEvidence.ts";
import type { AIEmployee } from "../aiEmployees.ts";

const employeeId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

const completeEmployee = {
  id: employeeId,
  user_id: userId,
  name: "Ava",
  business_name: "Nexa",
  department: "Support",
  business_description: "Support",
  greeting_message: "Hello",
  timezone: "Asia/Kolkata",
  working_hours: "9-5",
  language: "English",
  voice: "Female",
  knowledge_notes: "Reviewed",
  knowledge_website: "",
  knowledge_faq_document: "",
  knowledge_pdf_url: "",
} as AIEmployee;

const fullyReadyChannel = {
  linked: true,
  webhookConfigured: true,
  inboundReady: true,
  outboundEnabled: true,
};

const outboundOffChannel = {
  ...fullyReadyChannel,
  outboundEnabled: false,
};

function stubWriter(overrides: Partial<EvidenceWriter> = {}) {
  const written: ActivationEvidenceInsert[] = [];
  const writer: EvidenceWriter = {
    readEvidence: async () => ({ row: null, error: null }),
    writeEvidence: async (row) => {
      written.push(row);
      return { error: null };
    },
    ...overrides,
  };
  return { writer, written };
}

function freshRow(overrides: Partial<ActivationEvidenceInsert> = {}): ActivationEvidenceInsert {
  return {
    ai_employee_id: employeeId,
    workspace_id: workspaceId,
    channel_linked: true,
    webhook_configured: true,
    inbound_ready: true,
    outbound_enabled: true,
    verified_at: new Date().toISOString(),
    verified_by: userId,
    ...overrides,
  };
}

test("verification requires an authenticated actor", () => {
  assert.equal(
    authorizeActivationVerification({ actor: null, employeeId, employee: completeEmployee }),
    "unauthenticated",
  );
  assert.equal(
    authorizeActivationVerification({ actor: undefined, employeeId, employee: completeEmployee }),
    "unauthenticated",
  );
  assert.equal(
    authorizeActivationVerification({ actor: { id: "" }, employeeId, employee: completeEmployee }),
    "unauthenticated",
  );
});

test("verification rejects malformed actor and target ids", () => {
  assert.equal(
    authorizeActivationVerification({ actor: { id: "not-a-uuid" }, employeeId, employee: completeEmployee }),
    "unauthorized-actor",
  );
  assert.equal(
    authorizeActivationVerification({ actor: { id: userId }, employeeId: "not-a-uuid", employee: completeEmployee }),
    "invalid-target",
  );
});

test("verification requires the target employee to be visible to the actor", () => {
  assert.equal(
    authorizeActivationVerification({ actor: { id: userId }, employeeId, employee: null }),
    "not-found",
  );
  assert.equal(
    authorizeActivationVerification({
      actor: { id: userId },
      employeeId,
      employee: { ...completeEmployee, id: "44444444-4444-4444-8444-444444444444" },
    }),
    "not-found",
  );
});

test("verification allows an employee owned by the actor", () => {
  assert.equal(
    authorizeActivationVerification({ actor: { id: userId }, employeeId, employee: completeEmployee }),
    "ok",
  );
});

test("missing evidence is reported as missing", () => {
  assert.deepEqual(classifyEvidence(null), { state: "missing", verifiedAt: null });
});

test("stale evidence older than 24 hours is reported as stale", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const stale = freshRow({
    verified_at: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
  });
  assert.deepEqual(classifyEvidence(stale, now), { state: "stale", verifiedAt: stale.verified_at });
});

test("fresh complete evidence is reported as fresh", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const fresh = freshRow({
    verified_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
  });
  assert.deepEqual(classifyEvidence(fresh, now), { state: "fresh", verifiedAt: fresh.verified_at });
});

test("fresh incomplete evidence (outbound disabled) is reported as incomplete", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const incomplete = freshRow({
    outbound_enabled: false,
    verified_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
  });
  assert.deepEqual(classifyEvidence(incomplete, now), {
    state: "incomplete",
    verifiedAt: incomplete.verified_at,
  });
});

test("verification refuses to write evidence for an unauthenticated actor", async () => {
  const { writer, written } = stubWriter();
  const response = await verifyActivationEvidence({
    actor: null,
    employeeId,
    employee: completeEmployee,
    workspaceId,
    channel: fullyReadyChannel,
    verifiedBy: userId,
    writer,
  });
  assert.equal(response.ok, false);
  if (response.ok) return;
  assert.equal(response.error, "unauthenticated");
  assert.equal(written.length, 0);
});

test("verification fails closed when evidence cannot be written", async () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const staleRow = freshRow({
    verified_at: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
  });
  const { writer } = stubWriter({
    readEvidence: async () => ({ row: staleRow, error: null }),
    writeEvidence: async () => ({ error: "write denied" }),
  });
  const response = await verifyActivationEvidence({
    actor: { id: userId },
    employeeId,
    employee: completeEmployee,
    workspaceId,
    channel: fullyReadyChannel,
    verifiedBy: userId,
    writer,
    now,
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.equal(response.result.allReady, true);
  assert.equal(response.result.activationReady, false);
  assert.equal(response.result.evidenceState, "stale");
});

test("outbound disabled keeps activation locked even when every other check passes", async () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const { writer, written } = stubWriter();
  const response = await verifyActivationEvidence({
    actor: { id: userId },
    employeeId,
    employee: completeEmployee,
    workspaceId,
    channel: outboundOffChannel,
    verifiedBy: userId,
    writer,
    now,
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.equal(response.result.allReady, false);
  assert.equal(response.result.activationReady, false);
  assert.equal(response.result.evidenceState, "incomplete");
  assert.equal(response.result.checks.find((check) => check.key === "outbound")?.ready, false);
  assert.equal(written.length, 1);
  assert.equal(written[0].outbound_enabled, false);
  assert.equal(written[0].ai_employee_id, employeeId);
  assert.equal(written[0].workspace_id, workspaceId);
  assert.equal(written[0].verified_by, userId);
});

test("a counterfeit stored evidence row cannot override the fresh server verdict", async () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const counterfeitRow = freshRow({ verified_at: now.toISOString() });
  const { writer, written } = stubWriter({
    readEvidence: async () => ({ row: counterfeitRow, error: null }),
  });
  const response = await verifyActivationEvidence({
    actor: { id: userId },
    employeeId,
    employee: completeEmployee,
    workspaceId,
    channel: outboundOffChannel,
    verifiedBy: userId,
    writer,
    now,
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.equal(response.result.activationReady, false);
  assert.equal(response.result.evidenceState, "incomplete");
  assert.equal(written[0].outbound_enabled, false);
});

test("missing knowledge stays locked even with a complete channel", async () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const { writer } = stubWriter();
  const noKnowledge = {
    ...completeEmployee,
    knowledge_notes: "",
    knowledge_website: "",
    knowledge_faq_document: "",
    knowledge_pdf_url: "",
  };
  const response = await verifyActivationEvidence({
    actor: { id: userId },
    employeeId,
    employee: noKnowledge,
    workspaceId,
    channel: fullyReadyChannel,
    verifiedBy: userId,
    writer,
    now,
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.equal(response.result.allReady, false);
  assert.equal(response.result.activationReady, false);
  assert.equal(response.result.checks.find((check) => check.key === "knowledge")?.ready, false);
});

test("a fully verified employee records complete fresh evidence and unlocks", async () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const { writer, written } = stubWriter();
  const response = await verifyActivationEvidence({
    actor: { id: userId },
    employeeId,
    employee: completeEmployee,
    workspaceId,
    channel: fullyReadyChannel,
    verifiedBy: userId,
    writer,
    now,
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.equal(response.result.allReady, true);
  assert.equal(response.result.activationReady, true);
  assert.equal(response.result.evidenceState, "fresh");
  assert.equal(written[0].outbound_enabled, true);
});