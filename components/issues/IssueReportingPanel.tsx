"use client";

import { useState } from "react";
import SettingsFeedback, { type SettingsMessage } from "@/components/ai/SettingsFeedback";
import Card from "@/components/ui/Card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ISSUE_REPORT_CATEGORIES, ISSUE_REPORT_DESCRIPTION_MAX_LENGTH, ISSUE_REPORT_DESCRIPTION_MIN_LENGTH, ISSUE_REPORT_TITLE_MAX_LENGTH, ISSUE_REPORT_TITLE_MIN_LENGTH, createIssueReport, type IssueReport, type IssueReportCategory } from "@/lib/issueReports";

const categoryLabels: Record<IssueReportCategory, string> = { bug: "Bug", usability: "Usability", privacy: "Privacy", security: "Security", other: "Other" };

export default function IssueReportingPanel({ workspaceId, initialReports }: { workspaceId: string; initialReports: IssueReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [category, setCategory] = useState<IssueReportCategory>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(null);
    const client = createSupabaseBrowserClient();
    if (!client) return setMessage({ type: "error", text: "Issue reporting is temporarily unavailable. Please try again later." });
    setBusy(true);
    const result = await createIssueReport(client, workspaceId, { category, title, description });
    setBusy(false);
    if (result.error || !result.data) return setMessage({ type: "error", text: result.error ?? "Could not submit this report. Please try again later." });
    setReports((current) => [result.data!, ...current].slice(0, 50));
    setCategory("bug"); setTitle(""); setDescription("");
    setMessage({ type: "success", text: "Issue report submitted to your workspace." });
  }

  return <div className="space-y-6">
    <Card className="space-y-4 border-amber-900/60 bg-amber-950/10"><h2 className="text-xl font-semibold">Share only what is necessary</h2><p className="text-zinc-300">Do not include passwords, access tokens, phone numbers, customer messages, request URLs, cookies, headers, environment values, logs, or stack traces. Nexa does not attach them automatically and this form has no hidden telemetry.</p></Card>
    <Card className="space-y-5">
      <div><h2 className="text-2xl font-bold">New issue report</h2><p className="mt-1 text-zinc-400">Category, title, and description are the only report content saved.</p></div>
      <form onSubmit={submit} className="grid gap-4" aria-busy={busy} aria-describedby={message ? "issue-report-feedback" : undefined}>
        <label htmlFor="issue-category" className="space-y-2 text-sm font-medium text-zinc-200">Category<select id="issue-category" name="category" value={category} onChange={(event) => setCategory(event.target.value as IssueReportCategory)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white">{ISSUE_REPORT_CATEGORIES.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}</select></label>
        <label htmlFor="issue-title" className="space-y-2 text-sm font-medium text-zinc-200">Title<input id="issue-title" name="title" required minLength={ISSUE_REPORT_TITLE_MIN_LENGTH} maxLength={ISSUE_REPORT_TITLE_MAX_LENGTH} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" placeholder="Short summary using synthetic details" /></label>
        <label htmlFor="issue-description" className="space-y-2 text-sm font-medium text-zinc-200">Description<textarea id="issue-description" name="description" required minLength={ISSUE_REPORT_DESCRIPTION_MIN_LENGTH} maxLength={ISSUE_REPORT_DESCRIPTION_MAX_LENGTH} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" placeholder="What happened, what you expected, and synthetic steps to reproduce" /></label>
        <p className="text-xs text-zinc-500">{description.length}/{ISSUE_REPORT_DESCRIPTION_MAX_LENGTH} description characters</p>
        <button type="submit" disabled={busy} aria-busy={busy} className="w-fit rounded-xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 disabled:opacity-60">{busy ? "Submitting report…" : "Submit issue report"}</button>
      </form>
      {message ? <SettingsFeedback id="issue-report-feedback" message={message} /> : null}
    </Card>
    <section className="space-y-4" aria-labelledby="saved-issue-reports"><div><h2 id="saved-issue-reports" className="text-2xl font-bold">Visible reports</h2><p className="mt-1 text-zinc-400">You can read reports you submitted. Workspace Owners and Admins can read all workspace reports for triage.</p></div>
      {reports.length === 0 ? <Card><h3 className="text-lg font-semibold">No visible issue reports</h3><p className="mt-2 text-zinc-400">Submit a report when something needs attention. No example or fabricated reports are shown.</p></Card> : reports.map((report) => <Card key={report.id} className="space-y-3"><div className="flex flex-wrap items-center gap-3"><span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">{categoryLabels[report.category]}</span><time className="text-sm text-zinc-500" dateTime={report.created_at}>{new Date(report.created_at).toLocaleString()}</time></div><h3 className="text-xl font-semibold">{report.title}</h3><p className="whitespace-pre-wrap text-zinc-300">{report.description}</p></Card>)}
    </section>
  </div>;
}
