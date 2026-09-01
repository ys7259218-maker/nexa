"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createIssueReport, ISSUE_CATEGORIES, ISSUE_DESCRIPTION_MAX_LENGTH, ISSUE_TITLE_MAX_LENGTH, type IssueCategory } from "@/lib/issueReports";

export default function IssueReportForm({ workspaceId }: { workspaceId: string }) {
  const [category, setCategory] = useState<IssueCategory>("bug");
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(null);
    const client = createSupabaseBrowserClient();
    if (!client) return setMessage({ type: "error", text: "Issue reporting is temporarily unavailable. Please try again later." });
    setBusy(true); const result = await createIssueReport(client, workspaceId, { category, title, description }); setBusy(false);
    if (result.error) return setMessage({ type: "error", text: result.error });
    setTitle(""); setDescription(""); setMessage({ type: "success", text: "Issue report submitted. Only the text you entered and basic report metadata were saved." });
  }
  return <form className="space-y-5" onSubmit={submit} aria-busy={busy}>
    <div><label className="block text-sm font-medium" htmlFor="issue-category">Category</label><select id="issue-category" value={category} onChange={(e) => setCategory(e.target.value as IssueCategory)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3">{ISSUE_CATEGORIES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></div>
    <div><label className="block text-sm font-medium" htmlFor="issue-title">Title</label><input id="issue-title" required minLength={3} maxLength={ISSUE_TITLE_MAX_LENGTH} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /></div>
    <div><label className="block text-sm font-medium" htmlFor="issue-description">Description</label><textarea id="issue-description" required minLength={10} maxLength={ISSUE_DESCRIPTION_MAX_LENGTH} rows={7} value={description} onChange={(e) => setDescription(e.target.value)} aria-describedby="issue-privacy-note" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /></div>
    <p id="issue-privacy-note" className="text-sm text-zinc-400">Describe only what is needed. Do not include passwords, tokens, customer messages, phone numbers, or other sensitive data. Nexa does not automatically attach logs, headers, cookies, URLs, environment values, stack traces, or telemetry.</p>
    <button disabled={busy} className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-black disabled:opacity-60">{busy ? "Submitting…" : "Submit issue"}</button>
    {message ? <p role={message.type === "error" ? "alert" : "status"} className={message.type === "error" ? "text-red-300" : "text-emerald-300"}>{message.text}</p> : null}
  </form>;
}
