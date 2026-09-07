"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OutcomeState = { tone: "error" | "info"; text: string } | null;

export default function RetryAllButton({ retryableCount }: { retryableCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<OutcomeState>(null);

  async function handleRetryAll() {
    setPending(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/failed-sends/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; summary?: { queued?: number; skipped?: number }; error?: string }
        | null;

      if (response.ok && payload?.ok) {
        setOutcome({
          tone: "info",
          text: `Queued ${payload.summary?.queued ?? 0} · Skipped ${payload.summary?.skipped ?? 0}`,
        });
        router.refresh();
        return;
      }

      setOutcome({ tone: "error", text: payload?.error ?? "The retry request failed." });
    } catch {
      setOutcome({ tone: "error", text: "The retry request failed. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleRetryAll}
        disabled={pending || retryableCount === 0}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
      >
        {pending ? "Retrying…" : `Retry ${retryableCount} retryable`}
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