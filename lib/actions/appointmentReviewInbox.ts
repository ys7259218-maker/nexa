import type { SupabaseClient } from "@supabase/supabase-js";

export const REVIEW_INBOX_LIMIT = 30;
export const REVIEW_INBOX_SCAN_LIMIT = 300;
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

    const { data, error } = await client.from("appointment_review_requests")
      .select("id,workspace_id,conversation_id,inbound_message_id,requested_at,customer_request,status,created_at")
      .eq("workspace_id", workspaceId).eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(REVIEW_INBOX_SCAN_LIMIT);
    if (error || !data) return { ok: false, error: "unavailable" };
    // RLS is the primary security boundary. Reject unexpected rows rather than
    // accidentally returning data if a privileged client gets passed in.
    if (data.some(item => item.workspace_id !== workspaceId || item.status !== "pending_review")) {
      return { ok: false, error: "unavailable" };
    }
    if (data.length === 0) return { ok: true, items: [] };
    // Pending status on the immutable source is not a decision status. Hide
    // records that already have an irreversible human decision ledger entry.
    const { data: decided, error: decidedError } = await client
      .from("appointment_review_decisions").select("review_request_id")
      .eq("workspace_id", workspaceId).in("review_request_id", data.map(item => item.id));
    if (decidedError || !decided || decided.some(item =>
      typeof item.review_request_id !== "string")) return { ok: false, error: "unavailable" };
    const decidedIds = new Set(decided.map(item => item.review_request_id));
    const stillPending = (data as PendingReviewRow[]).filter(item => !decidedIds.has(item.id));
    // Never show a misleading empty or partial inbox when the scan cap was
    // exhausted by already-decided rows. Prefer explicit unavailable until
    // keyset-pagination / a DB-side anti-join is independently validated.
    if (data.length === REVIEW_INBOX_SCAN_LIMIT && stillPending.length < REVIEW_INBOX_LIMIT) {
      return { ok: false, error: "unavailable" };
    }
    return { ok: true, items: stillPending.slice(0, REVIEW_INBOX_LIMIT) };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
