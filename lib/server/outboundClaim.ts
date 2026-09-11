import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Outbound pre-send claim client (migration `20260911164532_outbound_atomic_claim_v1.sql`).
 *
 * `claim_outbound_message_send` atomically reserves the exact `messages` row for
 * one transport attempt; exactly one concurrent claimant wins. `finalize` flips
 * the row to `sent` only with this session's token; `release` cancels an unused
 * claim only with the matching token. All three are service-role-only RPCs, so
 * every failure here is reported honestly (never coerced into a successful
 * send), and an RPC-level error always fails closed.
 */

export type ClaimReason =
  | "claimed"
  | "already_claimed"
  | "not_found"
  | "not_draft"
  | "opted_out"
  | "human_takeover"
  | "ineligible"
  | "claim_error";

export type ClaimDeniedReason = Exclude<ClaimReason, "claimed">;

export type ClaimOutcome =
  | { ok: true; token: string }
  | { ok: false; reason: ClaimDeniedReason };

export type FinalizeReason = "finalized" | "not_found" | "claim_mismatch" | "finalize_error";

export type FinalizeOutcome =
  | { ok: true }
  | { ok: false; reason: Exclude<FinalizeReason, "finalized"> };

export type ReleaseReason = "released" | "not_found" | "claim_mismatch" | "release_error";

export type ReleaseOutcome =
  | { ok: true }
  | { ok: false; reason: Exclude<ReleaseReason, "released"> };

type RpcRow = { [key: string]: unknown };

export async function claimOutboundMessageSend(
  service: SupabaseClient,
  messageId: string,
  ownerUserId: string,
): Promise<ClaimOutcome> {
  const result = await service.rpc("claim_outbound_message_send", {
    p_message_id: messageId,
    p_owner_user_id: ownerUserId,
  });
  if (result.error) return { ok: false, reason: "claim_error" };
  const first = Array.isArray(result.data) ? (result.data[0] as RpcRow | undefined) : undefined;
  if (!first || typeof first.reason !== "string") return { ok: false, reason: "claim_error" };

  if (first.reason === "claimed") {
    if (typeof first.claim_token === "string" && first.claim_token.length > 0) {
      return { ok: true, token: first.claim_token };
    }
    return { ok: false, reason: "claim_error" };
  }

  switch (first.reason) {
    case "already_claimed":
    case "not_found":
    case "not_draft":
    case "opted_out":
    case "human_takeover":
    case "ineligible":
      return { ok: false, reason: first.reason };
    default:
      return { ok: false, reason: "claim_error" };
  }
}

export interface OutboundSendRecord {
  waMessageId: string;
  sentAt: string;
  templateName?: string | null;
}

export async function finalizeOutboundMessageSend(
  service: SupabaseClient,
  messageId: string,
  claimToken: string,
  ownerUserId: string,
  record: OutboundSendRecord,
): Promise<FinalizeOutcome> {
  const result = await service.rpc("finalize_outbound_message_send", {
    p_message_id: messageId,
    p_claim_token: claimToken,
    p_owner_user_id: ownerUserId,
    p_wa_message_id: record.waMessageId,
    p_sent_at: record.sentAt,
    p_template_name: record.templateName ?? null,
  });
  if (result.error) return { ok: false, reason: "finalize_error" };
  const first = Array.isArray(result.data) ? (result.data[0] as RpcRow | undefined) : undefined;
  if (!first || typeof first.reason !== "string") return { ok: false, reason: "finalize_error" };

  if (first.reason === "finalized") return { ok: true };
  switch (first.reason) {
    case "not_found":
    case "claim_mismatch":
      return { ok: false, reason: first.reason };
    default:
      return { ok: false, reason: "finalize_error" };
  }
}

export async function releaseOutboundMessageSend(
  service: SupabaseClient,
  messageId: string,
  claimToken: string,
  ownerUserId: string,
): Promise<ReleaseOutcome> {
  const result = await service.rpc("release_outbound_message_send", {
    p_message_id: messageId,
    p_claim_token: claimToken,
    p_owner_user_id: ownerUserId,
  });
  if (result.error) return { ok: false, reason: "release_error" };
  const first = Array.isArray(result.data) ? (result.data[0] as RpcRow | undefined) : undefined;
  if (!first || typeof first.reason !== "string") return { ok: false, reason: "release_error" };

  if (first.reason === "released") return { ok: true };
  switch (first.reason) {
    case "not_found":
    case "claim_mismatch":
      return { ok: false, reason: first.reason };
    default:
      return { ok: false, reason: "release_error" };
  }
}