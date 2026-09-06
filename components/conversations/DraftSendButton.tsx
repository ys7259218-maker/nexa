"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DraftSendButtonProps = {
  messageId: string;
  windowOpen: boolean;
};

type OutcomeState = { tone: "error" | "info"; text: string } | null;

export default function DraftSendButton({ messageId, windowOpen }: DraftSendButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<OutcomeState>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en");
  const [templateParams, setTemplateParams] = useState("");

  async function handleSend(template?: { name: string; language: string; params: string[] }) {
    setPending(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/outbound/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          ...(template
            ? {
                templateName: template.name,
                templateLanguage: template.language,
                ...(template.params.length > 0 ? { templateParams: template.params } : {}),
              }
            : {}),
        }),
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

  if (windowOpen) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleSend()}
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

  const params = templateParams
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 10);

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-neutral-500">Template name</span>
        <input
          type="text"
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          placeholder="order_confirmed"
          aria-label="Approved template name"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-[11px] text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-neutral-500">Language</span>
        <input
          type="text"
          value={templateLanguage}
          onChange={(event) => setTemplateLanguage(event.target.value)}
          placeholder="en"
          maxLength={20}
          aria-label="Template language code"
          className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-[11px] text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-neutral-500">Params (comma separated, max 10)</span>
        <input
          type="text"
          value={templateParams}
          onChange={(event) => setTemplateParams(event.target.value)}
          placeholder="#ORD-123, Mumbai"
          aria-label="Template params"
          className="w-56 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-[11px] text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={() =>
          templateName.trim()
            ? handleSend({
                name: templateName.trim(),
                language: templateLanguage.trim() || "en",
                params,
              })
            : setOutcome({ tone: "error", text: "Enter a template name." })
        }
        disabled={pending}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send as template"}
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