import type { SupabaseClient } from "@supabase/supabase-js";

import { listFailedSends } from "./failedSends.ts";
import {
  isValidDraftMessageId,
  sendApprovedDraft,
  type ApproveDraftOutcome,
} from "./server/draftSender.ts";

export const MAX_BATCH_MESSAGE_IDS = 20;

/**
 * Upper bound for the failed-sends scan the retry path performs. Retry must see
 * the complete retryable set (Retry All retries every eligible send), so this
 * deliberately exceeds the page's display cap; it still hard-bounds the query.
 */
export const RETRY_SCAN_LIMIT = 1_000;

export function isValidMessageIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_BATCH_MESSAGE_IDS &&
    value.every((entry) => isValidDraftMessageId(entry))
  );
}

export interface FailedSendRetryItem {
  messageId: string;
  queued: boolean;
  reason?: string;
}

export type RetryFailedSendsResult =
  | { results: FailedSendRetryItem[]; error: null }
  | { results: null; error: string };

export interface RetryFailedSendsOptions {
  /** When provided, only these message ids are considered; otherwise all retryable sends. */
  messageIds?: string[];
  now?: Date;
  /** Injectable per-send action (defaults to the real approve-and-send path). */
  sendDraft?: (messageId: string) => Promise<ApproveDraftOutcome>;
}

/**
 * Resubmits the current retryable failed-sends queue through the same guarded
 * approve-and-send path as the pending-approvals queue. A send is only ever a
 * candidate here when `listFailedSends` marked it retryable (outbound enabled,
 * service window open, free-form); each candidate is re-verified per-message by
 * `sendApprovedDraft` (ownership, opt-out, takeover, E.164, window) at send time,
 * so a stale page can never force a message out.
 */
export async function retryFailedSends(
  service: SupabaseClient,
  sessionUserId: string,
  outboundReady: boolean,
  options: RetryFailedSendsOptions = {},
): Promise<RetryFailedSendsResult> {
  const queue = await listFailedSends(service, outboundReady, options.now ?? new Date(), RETRY_SCAN_LIMIT);
  if (queue.error !== null) {
    return { results: null, error: queue.error };
  }

  const allowed = options.messageIds ? new Set(options.messageIds) : null;
  const retryable = queue.data.sends.filter(
    (send) => send.retryable && (!allowed || allowed.has(send.id)),
  );

  const sendDraft =
    options.sendDraft ??
    ((messageId: string) => sendApprovedDraft(service, sessionUserId, messageId));

  const results: FailedSendRetryItem[] = [];
  for (const send of retryable) {
    try {
      const outcome = await sendDraft(send.id);
      results.push({
        messageId: send.id,
        queued: outcome.ok,
        reason: outcome.ok ? undefined : outcome.message,
      });
    } catch {
      results.push({ messageId: send.id, queued: false, reason: "The retry request failed." });
    }
  }

  return { results, error: null };
}