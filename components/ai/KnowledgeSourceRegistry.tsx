"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  KNOWLEDGE_SOURCE_FILE_MAX_BYTES, KNOWLEDGE_SOURCE_FILE_NAME_MAX_LENGTH,
  KNOWLEDGE_SOURCE_LABEL_MAX_LENGTH, KNOWLEDGE_SOURCE_URL_MAX_LENGTH,
  createKnowledgeSource, deleteKnowledgeSource, markKnowledgeSourceReviewed,
  type KnowledgeSource, type KnowledgeSourceDeletionReceipt, type KnowledgeSourceInput, type KnowledgeSourceKind,
} from "@/lib/knowledgeSources";

const emptyInput: KnowledgeSourceInput = { kind: "website", label: "", websiteUrl: "", fileName: "", fileMediaType: "", fileSizeBytes: null };

function formatBytes(value: number | null) {
  if (value === null) return "";
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeSourceRegistry({ employeeId, initialSources, initialReceipts }: { employeeId: string; initialSources: KnowledgeSource[]; initialReceipts: KnowledgeSourceDeletionReceipt[] }) {
  const [sources, setSources] = useState(initialSources);
  const [receipts, setReceipts] = useState(initialReceipts);
  const [draft, setDraft] = useState<KnowledgeSourceInput>(emptyInput);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setMessage("Supabase is not configured.");
    setBusy(true); setMessage(null);
    const result = await createKnowledgeSource(supabase, employeeId, draft);
    setBusy(false);
    if (result.error || !result.data) return setMessage(result.error ?? "Could not add this source reference.");
    setSources((current) => [result.data!, ...current]);
    setDraft(emptyInput);
    setMessage("Source reference added. No content was uploaded or processed.");
  }

  async function remove(source: KnowledgeSource) {
    if (!window.confirm(`Delete the source reference “${source.label}”?`)) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setMessage("Supabase is not configured.");
    setBusy(true); setMessage(null);
    const result = await deleteKnowledgeSource(supabase, employeeId, source.id);
    setBusy(false);
    if (result.error || !result.data) return setMessage(result.error ?? "Could not create a deletion receipt.");
    setSources((current) => current.filter((item) => item.id !== source.id));
    setReceipts((current) => [result.data!, ...current].slice(0, 20));
    setMessage(`Source reference deleted. Receipt ${result.data.id.slice(0, 8)} recorded without source details.`);
  }

  async function review(source: KnowledgeSource) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setMessage("Supabase is not configured.");
    setBusy(true); setMessage(null);
    const result = await markKnowledgeSourceReviewed(supabase, employeeId, source.id, 90);
    setBusy(false);
    if (result.error || !result.data) return setMessage(result.error ?? "Could not record this manual review.");
    setSources((current) => current.map((item) => item.id === source.id ? result.data! : item));
    setMessage("Manual metadata review recorded. Nexa did not open or verify the source content.");
  }

  return <div className="space-y-6">
    <Card className="space-y-5 border-amber-900/60 bg-amber-950/10">
      <h2 className="text-2xl font-bold">Reference metadata only</h2>
      <p className="max-w-3xl text-zinc-300">Nexa saves only the website address or the PDF/TXT file metadata you type here. It does not upload a file, visit or crawl a website, download content, parse text, create embeddings, or use these references in AI replies.</p>
    </Card>
    <Card className="space-y-5">
      <div><h2 className="text-2xl font-bold">Add a source reference</h2><p className="mt-1 text-zinc-400">Public HTTPS websites and metadata for PDF or plain-text files are supported.</p></div>
      <form onSubmit={create} className="grid gap-4">
        <label className="space-y-2 text-sm font-medium text-zinc-200">Source type
          <select value={draft.kind} onChange={(event) => setDraft({ ...emptyInput, kind: event.target.value as KnowledgeSourceKind })} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"><option value="website">Public HTTPS website</option><option value="file">PDF/TXT file metadata</option></select>
        </label>
        <label className="space-y-2 text-sm font-medium text-zinc-200">Reference label
          <input required maxLength={KNOWLEDGE_SOURCE_LABEL_MAX_LENGTH} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Example: Public help center" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </label>
        {draft.kind === "website" ? <label className="space-y-2 text-sm font-medium text-zinc-200">Public HTTPS URL
          <input required type="url" inputMode="url" maxLength={KNOWLEDGE_SOURCE_URL_MAX_LENGTH} value={draft.websiteUrl} onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })} placeholder="https://www.example.com/help" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
        </label> : <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm font-medium text-zinc-200 md:col-span-3">File name — no file is selected or uploaded
            <input required maxLength={KNOWLEDGE_SOURCE_FILE_NAME_MAX_LENGTH} value={draft.fileName} onChange={(event) => setDraft({ ...draft, fileName: event.target.value })} placeholder="handbook.pdf" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </label>
          <label className="space-y-2 text-sm font-medium text-zinc-200 md:col-span-2">File type
            <select required value={draft.fileMediaType} onChange={(event) => setDraft({ ...draft, fileMediaType: event.target.value as KnowledgeSourceInput["fileMediaType"] })} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"><option value="">Choose PDF or TXT</option><option value="application/pdf">PDF (.pdf)</option><option value="text/plain">Plain text (.txt)</option></select>
          </label>
          <label className="space-y-2 text-sm font-medium text-zinc-200">Size in bytes
            <input required type="number" min={1} max={KNOWLEDGE_SOURCE_FILE_MAX_BYTES} step={1} value={draft.fileSizeBytes ?? ""} onChange={(event) => setDraft({ ...draft, fileSizeBytes: event.target.value ? Number(event.target.value) : null })} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          </label>
        </div>}
        <button type="submit" disabled={busy} className="w-fit rounded-xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 disabled:opacity-60">{busy ? "Adding reference…" : "Add source reference"}</button>
      </form>
      {message ? <p role="status" className="text-sm text-zinc-400">{message}</p> : null}
    </Card>
    <div className="space-y-4">
      <div><h2 className="text-2xl font-bold">Saved source references</h2><p className="mt-1 text-zinc-400">{sources.length} of 50 references shown. None are active AI knowledge.</p></div>
      {sources.length === 0 ? <Card><h3 className="text-lg font-semibold">No source references yet</h3><p className="mt-2 text-zinc-400">Adding one records metadata only and does not begin ingestion.</p></Card> : sources.map((source) => <Card key={source.id} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">{source.kind === "website" ? "Website reference" : "File metadata"}</span><h3 className="mt-3 text-xl font-semibold">{source.label}</h3>{source.kind === "website" ? <p className="mt-2 break-all text-sm text-zinc-400">{source.website_url}</p> : <p className="mt-2 text-sm text-zinc-400">{source.file_name} · {source.file_media_type} · {formatBytes(source.file_size_bytes)}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => review(source)} disabled={busy} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-60">Record manual review</button><button type="button" onClick={() => remove(source)} disabled={busy} className="rounded-xl border border-red-900 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-60">Delete reference</button></div></div>
        <p className="text-sm text-zinc-400">{source.reviewed_at ? `Metadata manually reviewed ${new Date(source.reviewed_at).toLocaleDateString()}; review due ${new Date(source.review_due_at!).toLocaleDateString()}.` : "Metadata has not been manually reviewed."}</p>
        <p className="text-sm text-amber-200">Stored as a reference only — not uploaded, crawled, parsed, embedded, or used by AI.</p>
      </Card>)}
    </div>
    <Card className="space-y-3"><h2 className="text-2xl font-bold">Deletion receipts</h2><p className="text-zinc-400">Receipts prove registry rows were deleted without retaining labels, URLs, file names, sizes, or content.</p>{receipts.length === 0 ? <p className="text-sm text-zinc-500">No deletion receipts yet.</p> : <ul className="space-y-2 text-sm text-zinc-300">{receipts.map((receipt) => <li key={receipt.id}>Receipt {receipt.id.slice(0, 8)} · {receipt.source_kind} · {new Date(receipt.deleted_at).toLocaleString()}</li>)}</ul>}</Card>
  </div>;
}
