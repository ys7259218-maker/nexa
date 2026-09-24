/**
 * Pure, side-effect-free boundary for a future appointment-request action.
 *
 * This is NOT a booking engine: the only successful result is a proposal that
 * requires human review. Never tell the customer an appointment was booked.
 * IDs must come from an authenticated, workspace-scoped caller, not the model.
 */
export type AppointmentProposal = Readonly<{
  kind: "appointment_request";
  workspaceId: string;
  conversationId: string;
  inboundMessageId: string;
  requestedAt: string;
  customerRequest: string;
  status: "pending_review";
}>;

export type ProposalResult =
  | { ok: true; proposal: AppointmentProposal }
  | { ok: false; reason: "invalid_context" | "invalid_request" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_LENGTH = 1000;

export function proposeAppointmentRequest(input: {
  workspaceId: unknown;
  conversationId: unknown;
  inboundMessageId: unknown;
  requestedAt: unknown;
  customerRequest: unknown;
}): ProposalResult {
  const { workspaceId, conversationId, inboundMessageId, requestedAt, customerRequest } = input;
  if (
    typeof workspaceId !== "string" || !UUID.test(workspaceId) ||
    typeof conversationId !== "string" || !UUID.test(conversationId) ||
    typeof inboundMessageId !== "string" || !UUID.test(inboundMessageId)
  ) {
    return { ok: false, reason: "invalid_context" };
  }

  // A caller must resolve real ownership, consent and the inbound event before
  // reaching this boundary. Model-provided IDs are never authority.
  if (
    typeof requestedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(requestedAt) ||
    !Number.isFinite(Date.parse(requestedAt)) ||
    typeof customerRequest !== "string" ||
    !customerRequest.trim() ||
    customerRequest.length > MAX_REQUEST_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(customerRequest)
  ) {
    return { ok: false, reason: "invalid_request" };
  }

  return {
    ok: true,
    proposal: Object.freeze({
      kind: "appointment_request",
      workspaceId,
      conversationId,
      inboundMessageId,
      requestedAt,
      customerRequest: customerRequest.trim(),
      status: "pending_review",
    }),
  };
}
