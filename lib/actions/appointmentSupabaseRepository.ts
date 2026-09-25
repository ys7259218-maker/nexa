import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppointmentReviewRepository } from "./appointmentReviewWorkflow.ts";

/** Authenticated, RLS-scoped client only. Never pass a service-role client. */
export function createAppointmentReviewRepository(client: SupabaseClient): AppointmentReviewRepository {
  return {
    async ownsInboundMessage({ actorId, workspaceId, conversationId, inboundMessageId }) {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || auth.user?.id !== actorId) return false;

      const { data: member, error: memberError } = await client
        .from("workspace_members").select("role")
        .eq("workspace_id", workspaceId).eq("user_id", actorId)
        .in("role", ["owner", "admin", "operator"]).maybeSingle();
      if (memberError || !member) return false;

      const { data: conversation, error: conversationError } = await client
        .from("conversations").select("id")
        .eq("id", conversationId).eq("workspace_id", workspaceId).maybeSingle();
      if (conversationError || !conversation) return false;

      const { data: inbound, error: inboundError } = await client
        .from("messages").select("id")
        .eq("id", inboundMessageId).eq("conversation_id", conversationId)
        .eq("workspace_id", workspaceId).eq("direction", "inbound").maybeSingle();
      return !inboundError && !!inbound;
    },

    async savePendingProposal(proposal) {
      // Do not trust the orchestrator as the only caller: a future direct call
      // to this repository must independently prove session and message scope.
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user?.id) return null;
      if (!await this.ownsInboundMessage({
        actorId: auth.user.id,
        workspaceId: proposal.workspaceId,
        conversationId: proposal.conversationId,
        inboundMessageId: proposal.inboundMessageId,
      })) return null;
      // Database UNIQUE(workspace_id,inbound_message_id) must enforce
      // concurrency-safe deduplication. Never upsert/reset a reviewed decision.
      const record = {
        workspace_id: proposal.workspaceId,
        conversation_id: proposal.conversationId,
        inbound_message_id: proposal.inboundMessageId,
        requested_at: proposal.requestedAt,
        customer_request: proposal.customerRequest,
        status: "pending_review",
      };
      const { data, error } = await client.from("appointment_review_requests")
        .insert(record)
        .select("workspace_id,inbound_message_id,requested_at,customer_request,status").single();

      if (error && error.code !== "23505") return null;
      let stored = data as typeof record | null;
      if (error?.code === "23505") {
        const existing = await client.from("appointment_review_requests")
          .select("workspace_id,inbound_message_id,requested_at,customer_request,status")
          .eq("workspace_id", proposal.workspaceId)
          .eq("inbound_message_id", proposal.inboundMessageId).maybeSingle();
        if (existing.error || !existing.data) return null;
        stored = existing.data as typeof record;
      }

      if (!stored || stored.workspace_id !== proposal.workspaceId ||
          stored.inbound_message_id !== proposal.inboundMessageId ||
          Date.parse(stored.requested_at) !== Date.parse(proposal.requestedAt) ||
          stored.customer_request !== proposal.customerRequest ||
          stored.status !== "pending_review") return null;

      return {
        workspaceId: stored.workspace_id,
        inboundMessageId: stored.inbound_message_id,
        requestedAt: stored.requested_at,
        customerRequest: stored.customer_request,
        status: "pending_review",
      };
    },
  };
}
