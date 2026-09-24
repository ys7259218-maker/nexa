import assert from "node:assert/strict";
import test from "node:test";

import {
  queueAppointmentForReview,
  type AppointmentReviewRepository,
} from "./appointmentReviewWorkflow.ts";

const valid = {
  actorId: "123e4567-e89b-42d3-a456-426614174009",
  workspaceId: "123e4567-e89b-42d3-a456-426614174000",
  conversationId: "123e4567-e89b-42d3-a456-426614174001",
  inboundMessageId: "123e4567-e89b-42d3-a456-426614174002",
  requestedAt: "2026-10-01T14:30:00+05:30",
  customerRequest: "Could I request an appointment?",
};

function fixture(overrides: Partial<AppointmentReviewRepository> = {}) {
  let ownershipChecks = 0;
  let saveAttempts = 0;
  const repository: AppointmentReviewRepository = {
    async ownsInboundMessage() { ownershipChecks++; return true; },
    async savePendingProposal(proposal) {
      saveAttempts++;
      return { workspaceId: proposal.workspaceId, inboundMessageId: proposal.inboundMessageId, status: "pending_review" };
    },
    ...overrides,
  };
  return { repository, counters: () => ({ ownershipChecks, saveAttempts }) };
}

test("queues only pending review when authenticated identity and inbound ownership are verified", async () => {
  const { repository, counters } = fixture();
  assert.deepEqual(await queueAppointmentForReview({ ...valid, repository }), { ok: true, status: "pending_review" });
  assert.deepEqual(counters(), { ownershipChecks: 1, saveAttempts: 1 });
});

test("rejects missing actor before any repository access", async () => {
  const { repository, counters } = fixture();
  assert.deepEqual(await queueAppointmentForReview({ ...valid, actorId: "from-model", repository }), { ok: false, error: "unauthenticated" });
  assert.deepEqual(counters(), { ownershipChecks: 0, saveAttempts: 0 });
});

test("rejects bad appointment request before any repository access", async () => {
  const { repository, counters } = fixture();
  assert.deepEqual(await queueAppointmentForReview({ ...valid, requestedAt: "tomorrow", repository }), { ok: false, error: "invalid_proposal" });
  assert.deepEqual(counters(), { ownershipChecks: 0, saveAttempts: 0 });
});

test("does not write when message ownership is not verified", async () => {
  const { repository, counters } = fixture({ async ownsInboundMessage() { return false; } });
  assert.deepEqual(await queueAppointmentForReview({ ...valid, repository }), { ok: false, error: "not_authorized" });
  assert.equal(counters().saveAttempts, 0);
});

test("fails closed if repository returns a cross-workspace or confirmed record", async () => {
  for (const changed of ["workspaceId", "inboundMessageId", "status"] as const) {
    const { repository } = fixture({
      async savePendingProposal(proposal) {
        const row = { workspaceId: proposal.workspaceId, inboundMessageId: proposal.inboundMessageId, status: "pending_review" as const };
        return { ...row, [changed]: changed === "status" ? "confirmed" : "123e4567-e89b-42d3-a456-426614174099" } as typeof row;
      },
    });
    assert.deepEqual(await queueAppointmentForReview({ ...valid, repository }), { ok: false, error: "unavailable" });
  }
});

test("database read and write failures reveal no content and never claim booking", async () => {
  for (const overrides of [
    { async ownsInboundMessage() { throw new Error("private customer message"); } },
    { async savePendingProposal() { throw new Error("private customer message"); } },
  ]) {
    const { repository } = fixture(overrides);
    const result = await queueAppointmentForReview({ ...valid, repository });
    assert.deepEqual(result, { ok: false, error: "unavailable" });
    assert.doesNotMatch(JSON.stringify(result), /private|confirmed|booked/);
  }
});
