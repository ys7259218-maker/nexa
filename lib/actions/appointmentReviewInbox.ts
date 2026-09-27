import type { SupabaseClient } from "@supabase/supabase-js";

export const REVIEW_INBOX_LIMIT = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PendingReviewRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  inbound_message_id: string;
  requested_at: string;
  customer_request: string;
  status: "pending_review";
  created_at: string;
};

/** RLS-scoped inbox read. Do not pass a service-role client. */
export async function listPendingAppointmentReviews(
  client: SupabaseClient,
  workspaceId: unknown,
): Promise<{ ok: true; items: PendingReviewRow[] } | { ok: false; error: "invalid_workspace" | "unauthenticated" | "not_authorized" | "unavailable" }> {
  if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) {
    return { ok: false, error: "invalid_workspace" };
  }
  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user?.id) return { ok: false, error: "unauthenticated" };

    const { data: membership, error: memberError } = await client
      .from("workspace_members").select("role")
      .eq("workspace_id", workspaceId).eq("user_id", auth.user.id)
      .in("role", ["owner", "admin", "operator"]).maybeSingle();
    if (memberError) return { ok: false, error: "unavailable" };
    if (!membership) return { ok: false, error: "not_authorized" };

    // This PostgreSQL 15+ SECURITY INVOKER view applies RLS on BOTH underlying
    // tables and excludes decided rows inside the database before LIMIT.
    // Never fall back to the raw queue when the view is unavailable.
    const { data, error } = await client.from("pending_appointment_review_inbox")
      .select("id,workspace_id,conversation_id,inbound_message_id,requested_at,customer_request,status,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(REVIEW_INBOX_LIMIT);
    if (error || !data) return { ok: false, error: "unavailable" };
    if (data.some(item => item.workspace_id !== workspaceId || item.status !== "pending_review")) {
      return { ok: false, error: "unavailable" };
    }
    return { ok: true, items: data as PendingReviewRow[] };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
