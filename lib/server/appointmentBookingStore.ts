import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentBookingLedger,
  BookingAuthorization,
  ConfirmedBooking,
} from "../actions/appointmentBooking.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TrustedBookingAuthorization =
  | { ok: true; bookingApprovalId: string; authorization: BookingAuthorization }
  | { ok: false; error: "invalid_request" | "unauthenticated" | "not_authorized" | "not_ready" | "unavailable" };

/**
 * Loads booking authority only from authenticated, RLS-scoped records.
 * Browser/model payload supplies IDs only; requested time, customer text,
 * customer confirmation and human approval timestamps are reloaded from DB.
 */
export async function loadTrustedBookingAuthorization(input: {
  actorClient: SupabaseClient;
  workspaceId: unknown;
  bookingApprovalId: unknown;
}): Promise<TrustedBookingAuthorization> {
  if (typeof input.workspaceId !== "string" || !UUID.test(input.workspaceId) ||
      typeof input.bookingApprovalId !== "string" || !UUID.test(input.bookingApprovalId)) {
    return { ok: false, error: "invalid_request" };
  }

  try {
    const { data: auth, error: authError } = await input.actorClient.auth.getUser();
    if (authError || !auth.user?.id) return { ok: false, error: "unauthenticated" };

    const { data: membership, error: membershipError } = await input.actorClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", input.workspaceId)
      .eq("user_id", auth.user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (membershipError) return { ok: false, error: "unavailable" };
    if (!membership) return { ok: false, error: "not_authorized" };

    const { data: approval, error: approvalError } = await input.actorClient
      .from("appointment_booking_approvals")
      .select("id,workspace_id,review_request_id,review_decision_id,customer_confirmation_message_id,approved_by_user_id,approved_at")
      .eq("id", input.bookingApprovalId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (approvalError) return { ok: false, error: "unavailable" };
    if (!approval) return { ok: false, error: "not_authorized" };

    const { data: review, error: reviewError } = await input.actorClient
      .from("appointment_review_requests")
      .select("id,workspace_id,conversation_id,inbound_message_id,requested_at,customer_request,created_at,status")
      .eq("id", approval.review_request_id)
      .eq("workspace_id", input.workspaceId)
      .eq("status", "pending_review")
      .maybeSingle();
    if (reviewError) return { ok: false, error: "unavailable" };
    if (!review) return { ok: false, error: "not_ready" };

    const { data: decision, error: decisionError } = await input.actorClient
      .from("appointment_review_decisions")
      .select("id,workspace_id,review_request_id,actor_user_id,decision,decided_at")
      .eq("id", approval.review_decision_id)
      .eq("review_request_id", review.id)
      .eq("workspace_id", input.workspaceId)
      .eq("decision", "approved_for_manual_followup")
      .maybeSingle();
    if (decisionError) return { ok: false, error: "unavailable" };
    if (!decision) return { ok: false, error: "not_ready" };

    const { data: confirmation, error: confirmationError } = await input.actorClient
      .from("messages")
      .select("id,workspace_id,conversation_id,direction,created_at")
      .eq("id", approval.customer_confirmation_message_id)
      .eq("workspace_id", input.workspaceId)
      .eq("conversation_id", review.conversation_id)
      .eq("direction", "inbound")
      .maybeSingle();
    if (confirmationError) return { ok: false, error: "unavailable" };
    if (!confirmation) return { ok: false, error: "not_ready" };

    if (approval.workspace_id !== input.workspaceId ||
        approval.review_request_id !== review.id ||
        approval.review_decision_id !== decision.id ||
        approval.customer_confirmation_message_id !== confirmation.id ||
        confirmation.id === review.inbound_message_id ||
        Date.parse(confirmation.created_at) < Date.parse(review.created_at) ||
        typeof approval.approved_by_user_id !== "string" ||
        !UUID.test(approval.approved_by_user_id)) {
      return { ok: false, error: "not_ready" };
    }

    return {
      ok: true,
      bookingApprovalId: approval.id,
      authorization: {
        workspaceId: review.workspace_id,
        reviewRequestId: review.id,
        requestedAt: review.requested_at,
        customerRequest: review.customer_request,
        customerConfirmedAt: confirmation.created_at,
        humanApprovedAt: approval.approved_at,
        humanApprovedByUserId: approval.approved_by_user_id,
      },
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

type BookingAttemptRow = {
  workspace_id: string;
  review_request_id: string;
  booking_approval_id: string;
  idempotency_key: string;
  status: "claimed" | "confirmed" | "failed";
  provider: string | null;
  provider_booking_id: string | null;
  starts_at: string | null;
};

function rowBooking(row: BookingAttemptRow): ConfirmedBooking | null {
  if (row.status !== "confirmed" || !row.provider || !row.provider_booking_id || !row.starts_at) return null;
  return {
    provider: row.provider,
    providerBookingId: row.provider_booking_id,
    startsAt: row.starts_at,
  };
}

/**
 * Service-role-only ledger writer. The caller MUST first use the actor's
 * RLS-scoped session to load/verify the approval chain above.
 */
export function createAppointmentBookingLedger(
  service: SupabaseClient,
  bookingApprovalId: string,
): AppointmentBookingLedger {
  return {
    async claim(input) {
      if (!UUID.test(bookingApprovalId)) return { status: "conflict" };
      const row = {
        workspace_id: input.workspaceId,
        review_request_id: input.reviewRequestId,
        booking_approval_id: bookingApprovalId,
        idempotency_key: input.idempotencyKey,
        status: "claimed",
      };
      const inserted = await service
        .from("appointment_booking_attempts")
        .insert(row)
        .select("workspace_id,review_request_id,booking_approval_id,idempotency_key,status,provider,provider_booking_id,starts_at")
        .maybeSingle();

      if (!inserted.error && inserted.data) return { status: "acquired" };
      if (inserted.error?.code !== "23505") throw new Error("booking claim unavailable");

      const existing = await service
        .from("appointment_booking_attempts")
        .select("workspace_id,review_request_id,booking_approval_id,idempotency_key,status,provider,provider_booking_id,starts_at")
        .eq("review_request_id", input.reviewRequestId)
        .maybeSingle();
      if (existing.error || !existing.data) throw new Error("booking claim lookup unavailable");
      const stored = existing.data as BookingAttemptRow;
      if (stored.workspace_id !== input.workspaceId ||
          stored.review_request_id !== input.reviewRequestId ||
          stored.booking_approval_id !== bookingApprovalId ||
          stored.idempotency_key !== input.idempotencyKey) return { status: "conflict" };

      const confirmed = rowBooking(stored);
      if (confirmed) return { status: "already_confirmed", booking: confirmed };
      if (stored.status === "claimed") return { status: "in_progress" };

      const reacquired = await service
        .from("appointment_booking_attempts")
        .update({
          status: "claimed",
          failure_code: null,
          provider: null,
          provider_booking_id: null,
          starts_at: null,
          confirmed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("review_request_id", input.reviewRequestId)
        .eq("booking_approval_id", bookingApprovalId)
        .eq("idempotency_key", input.idempotencyKey)
        .eq("status", "failed")
        .select("id")
        .maybeSingle();
      if (reacquired.error) throw new Error("booking retry claim unavailable");
      return reacquired.data ? { status: "acquired" } : { status: "in_progress" };
    },

    async complete(input) {
      const updated = await service
        .from("appointment_booking_attempts")
        .update({
          status: "confirmed",
          provider: input.booking.provider,
          provider_booking_id: input.booking.providerBookingId,
          starts_at: input.booking.startsAt,
          failure_code: null,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", input.workspaceId)
        .eq("review_request_id", input.reviewRequestId)
        .eq("booking_approval_id", bookingApprovalId)
        .eq("idempotency_key", input.idempotencyKey)
        .eq("status", "claimed")
        .select("id")
        .maybeSingle();
      if (updated.error) return false;
      return Boolean(updated.data);
    },

    async releaseAfterFailure(input) {
      const updated = await service
        .from("appointment_booking_attempts")
        .update({
          status: "failed",
          failure_code: input.failureCode,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", input.workspaceId)
        .eq("review_request_id", input.reviewRequestId)
        .eq("booking_approval_id", bookingApprovalId)
        .eq("idempotency_key", input.idempotencyKey)
        .eq("status", "claimed")
        .select("id")
        .maybeSingle();
      if (updated.error || !updated.data) throw new Error("booking failure release unavailable");
    },
  };
}
