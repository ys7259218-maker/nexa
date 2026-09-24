import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ManualReviewDecision = "approved_for_manual_followup" | "declined";

export type RecordDecisionResult =
  | { ok: true; decision: ManualReviewDecision; booked: false }
  | { ok: false; error: "invalid_request" | "unauthenticated" | "not_authorized" | "already_decided" | "unavailable" };

/** An authenticated human review outcome is not a booked appointment.
 * This never calls any booking, calendar, AI or outbound provider. */
export async function recordManualAppointmentDecision(
  client: SupabaseClient,
  input: { workspaceId: unknown; reviewRequestId: unknown; decision: unknown },
): Promise<RecordDecisionResult> {
  if (typeof input.workspaceId !== "string" || !UUID.test(input.workspaceId) ||
      typeof input.reviewRequestId !== "string" || !UUID.test(input.reviewRequestId) ||
      (input.decision !== "approved_for_manual_followup" && input.decision !== "declined")) {
    return { ok: false, error: "invalid_request" };
  }
  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user?.id) return { ok: false, error: "unauthenticated" };
    const actorId = auth.user.id;
    const { data: member, error: memberError } = await client.from("workspace_members")
      .select("role").eq("workspace_id", input.workspaceId).eq("user_id", actorId)
      .in("role", ["owner", "admin", "operator"]).maybeSingle();
    if (memberError) return { ok: false, error: "unavailable" };
    if (!member) return { ok: false, error: "not_authorized" };
    const { data: request, error: requestError } = await client.from("appointment_review_requests")
      .select("id,workspace_id,status").eq("id", input.reviewRequestId)
      .eq("workspace_id", input.workspaceId).eq("status", "pending_review").maybeSingle();
    if (requestError) return { ok: false, error: "unavailable" };
    if (!request || request.workspace_id !== input.workspaceId || request.status !== "pending_review") {
      return { ok: false, error: "not_authorized" };
    }

    // DB UNIQUE(review_request_id) is the concurrency boundary. Never UPSERT,
    // overwrite or retry with a different decision after a uniqueness conflict.
    const { data: row, error } = await client.from("appointment_review_decisions")
      .insert({
        workspace_id: input.workspaceId,
        review_request_id: input.reviewRequestId,
        actor_user_id: actorId,
        decision: input.decision,
      })
      .select("workspace_id,review_request_id,actor_user_id,decision").single();
    if (error?.code === "23505") return { ok: false, error: "already_decided" };
    if (error || !row ||
        row.workspace_id !== input.workspaceId ||
        row.review_request_id !== input.reviewRequestId ||
        row.actor_user_id !== actorId ||
        row.decision !== input.decision) return { ok: false, error: "unavailable" };
    return { ok: true, decision: row.decision as ManualReviewDecision, booked: false };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
