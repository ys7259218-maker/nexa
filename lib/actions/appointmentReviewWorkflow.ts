import {
  proposeAppointmentRequest,
  type AppointmentProposal,
} from "./actionProposal.ts";

/**
 * Server-only orchestration boundary. The repository must enforce workspace
 * membership and atomically deduplicate by inboundMessageId on the database
 * side. This module intentionally never sends or confirms a booking.
 *
 * No production call site or database migration is enabled by this slice.
 */
export interface AppointmentReviewRepository {
  /**
   * All three records must belong to the same authenticated workspace.
   * Do not use service-role reads as proof of the actor's membership.
   */
  ownsInboundMessage(input: {
    actorId: string;
    workspaceId: string;
    conversationId: string;
    inboundMessageId: string;
  }): Promise<boolean>;
  /**
   * One atomic, unique-by-(workspaceId,inboundMessageId) insert-or-read.
   * Returning a row from a different workspace is forbidden.
   */
  savePendingProposal(proposal: AppointmentProposal): Promise<{
    workspaceId: string;
    inboundMessageId: string;
    status: "pending_review";
    requestedAt: string;
    customerRequest: string;
  } | null>;
}

export type QueueAppointmentResult =
  | { ok: true; status: "pending_review" }
  | { ok: false; error: "unauthenticated" | "invalid_proposal" | "not_authorized" | "unavailable" };

export async function queueAppointmentForReview(input: {
  actorId: unknown;
  workspaceId: unknown;
  conversationId: unknown;
  inboundMessageId: unknown;
  requestedAt: unknown;
  customerRequest: unknown;
  repository: AppointmentReviewRepository;
}): Promise<QueueAppointmentResult> {
  if (typeof input.actorId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.actorId)) {
    return { ok: false, error: "unauthenticated" };
  }
  const result = proposeAppointmentRequest(input);
  if (!result.ok) return { ok: false, error: "invalid_proposal" };
  const proposal = result.proposal;
  try {
    const owned = await input.repository.ownsInboundMessage({
      actorId: input.actorId,
      workspaceId: proposal.workspaceId,
      conversationId: proposal.conversationId,
      inboundMessageId: proposal.inboundMessageId,
    });
    if (!owned) return { ok: false, error: "not_authorized" };
    const saved = await input.repository.savePendingProposal(proposal);
    if (!saved || saved.workspaceId !== proposal.workspaceId ||
      saved.inboundMessageId !== proposal.inboundMessageId ||
      saved.requestedAt !== proposal.requestedAt ||
      saved.customerRequest !== proposal.customerRequest ||
      saved.status !== "pending_review") {
      return { ok: false, error: "unavailable" };
    }
    return { ok: true, status: "pending_review" };
  } catch {
    // Do not leak any customer content, database error, or membership details.
    return { ok: false, error: "unavailable" };
  }
}
