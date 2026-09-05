"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DraftSendButtonProps = {
  messageId: string;
};

type OutcomeState = { tone: "error" | "info"; text: string } | null;

export default function DraftSendButton({ messageId }: DraftSendButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<OutcomeState>(null);

  async function handleSend() {
    setPending(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/outbound/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { sent?: boolean; error?: string }
        | null;

      if (response.ok && payload?.sent) {
        setOutcome({ tone: "info", text: "Draft approved and sent." });
        router.refresh();
        return;
      }

      setOutcome({ tone: "error", text: payload?.error ?? "The draft could not be sent." });
    } catch {
      setOutcome({ tone: "error", text: "The send request failed. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={pending}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Approve & send"}
      </button>
      {outcome ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-[11px] ${outcome.tone === "error" ? "text-red-300" : "text-emerald-300"}`}
        >
          {outcome.text}
        </p>
      ) : null}
    </div>
  );
}