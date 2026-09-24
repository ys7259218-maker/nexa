import assert from "node:assert/strict";
import test from "node:test";

import { proposeAppointmentRequest } from "./actionProposal.ts";

const valid = {
  workspaceId: "123e4567-e89b-42d3-a456-426614174000",
  conversationId: "123e4567-e89b-42d3-a456-426614174001",
  inboundMessageId: "123e4567-e89b-42d3-a456-426614174002",
  requestedAt: "2026-10-01T14:30:00+05:30",
  customerRequest: "Please request an appointment on Thursday.",
};

test("valid request creates only a pending-review proposal, never a booking", () => {
  const result = proposeAppointmentRequest(valid);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.proposal.status, "pending_review");
  assert.equal(result.proposal.kind, "appointment_request");
  assert.equal(result.proposal.inboundMessageId, valid.inboundMessageId);
  assert.equal(Object.isFrozen(result.proposal), true);
  assert.equal("confirmed" in result.proposal, false);
});

test("missing or malformed identity fails closed", () => {
  for (const field of ["workspaceId", "conversationId", "inboundMessageId"] as const) {
    for (const value of ["", "from-the-model", undefined, null]) {
      assert.deepEqual(proposeAppointmentRequest({ ...valid, [field]: value }), {
        ok: false, reason: "invalid_context",
      });
    }
  }
});

test("rejects absent, ambiguous, and invalid timestamps", () => {
  for (const requestedAt of ["tomorrow", "2026-10-01T14:30:00", "2026-99-01T14:30:00Z", "2026-02-30T14:30:00Z", "2026-04-31T14:30:00Z", "2026-10-01T24:30:00Z", "2026-10-01T14:60:00Z", "2026-10-01T14:30:60Z", "2026-10-01T14:30:00+24:00", "2026-10-01T14:30:00+05:99", "", null]) {
    assert.deepEqual(proposeAppointmentRequest({ ...valid, requestedAt }), {
      ok: false, reason: "invalid_request",
    });
  }
});

test("rejects empty, oversized, control-character, and non-text requests", () => {
  for (const customerRequest of ["", "   ", "x".repeat(1001), "book\nnow", 9, null]) {
    assert.deepEqual(proposeAppointmentRequest({ ...valid, customerRequest }), {
      ok: false, reason: "invalid_request",
    });
  }
});

test("trims request but does not invent availability or claim execution", () => {
  const result = proposeAppointmentRequest({ ...valid, customerRequest: "  Need an appointment  " });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.proposal.customerRequest, "Need an appointment");
  assert.equal(Object.keys(result.proposal).length, 7);
});
