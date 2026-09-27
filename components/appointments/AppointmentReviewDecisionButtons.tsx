"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Explicit human-only review action; this does not book or message anyone. */
export default function AppointmentReviewDecisionButtons({
  workspaceId, reviewRequestId,
}: { workspaceId: string; reviewRequestId: string }) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function decide(decision: "approved_for_manual_followup" | "declined") {
    if (!acknowledged || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/appointment-reviews/decision", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reviewRequestId, decision }),
      });
      const result = await response.json() as { error?: string; booked?: boolean };
      if (!response.ok || result.booked !== false) {
        setFeedback(response.status === 409
          ? "Another reviewer has already decided on this request. Refresh the inbox."
          : "Unable to save this review decision. Please refresh and try again.");
        return;
      }
      setFeedback(decision === "declined"
        ? "Request declined. No customer message was sent."
        : "Marked for manual follow-up. This is not a confirmed booking.");
      router.refresh();
    } catch {
      setFeedback("Unable to save this review decision. Please refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 p-3">
      <label className="flex items-start gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={acknowledged} disabled={busy}
          onChange={event => setAcknowledged(event.target.checked)} />
        I understand this only records a human review decision. No appointment is booked
        and no message is sent to the customer.
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!acknowledged || busy}
          onClick={() => void decide("approved_for_manual_followup")}
          className="rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200 disabled:opacity-40">
          Mark for manual follow-up
        </button>
        <button type="button" disabled={!acknowledged || busy}
          onClick={() => void decide("declined")}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40">
          Decline request
        </button>
      </div>
      {feedback ? <p role="status" className="text-xs text-zinc-300">{feedback}</p> : null}
    </div>
  );
}
