import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ReviewDecisionHistoryRow = {
  id: string;
  workspace_id: string;
  review_request_id: string;
  actor_user_id: string;
  decision: "approved_for_manual_followup" | "declined";
  decided_at: string;
};

/** Human decision history, not confirmed appointments. Actor-scoped client only. */
export async function listAppointmentReviewDecisions(client: SupabaseClient, workspaceId: unknown):
  Promise<{ ok: true; items: ReviewDecisionHistoryRow[] } | { ok: false; error: "invalid_workspace" | "unauthenticated" | "not_authorized" | "unavailable" }> {
  if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) return { ok: false, error: "invalid_workspace" };
  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user?.id) return { ok: false, error: "unauthenticated" };
    const { data: member, error: memberError } = await client.from("workspace_members")
      .select("role").eq("workspace_id", workspaceId).eq("user_id", auth.user.id)
      .in("role", ["owner", "admin", "operator"]).maybeSingle();
    if (memberError) return { ok: false, error: "unavailable" };
    if (!member) return { ok: false, error: "not_authorized" };
    const { data, error } = await client.from("appointment_review_decisions")
      .select("id,workspace_id,review_request_id,actor_user_id,decision,decided_at")
      .eq("workspace_id", workspaceId).order("decided_at", { ascending: false }).limit(30);
    if (error || !data) return { ok: false, error: "unavailable" };
    if (data.some(row => row.workspace_id !== workspaceId ||
      (row.decision !== "approved_for_manual_followup" && row.decision !== "declined"))) {
      return { ok: false, error: "unavailable" };
    }
    return { ok: true, items: data as ReviewDecisionHistoryRow[] };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
