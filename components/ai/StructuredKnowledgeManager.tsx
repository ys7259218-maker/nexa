"use client";

import { useState } from "react";

import Card from "@/components/ui/Card";
import SettingsFeedback, { type SettingsMessage } from "@/components/ai/SettingsFeedback";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  KNOWLEDGE_CONTENT_MAX_LENGTH,
  KNOWLEDGE_QUESTION_MAX_LENGTH,
  KNOWLEDGE_TITLE_MAX_LENGTH,
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  updateKnowledgeEntry,
  type KnowledgeEntry,
  type KnowledgeEntryInput,
  type KnowledgeEntryKind,
} from "@/lib/knowledgeEntries";

const emptyInput: KnowledgeEntryInput = {
  kind: "faq",
  title: "",
  question: "",
  content: "",
  verified: false,
};

function KnowledgeFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: KnowledgeEntryInput;
  onChange: (value: KnowledgeEntryInput) => void;
}) {
  return (
    <div className="grid gap-4">
      <label htmlFor={`${idPrefix}-kind`} className="space-y-2 text-sm font-medium text-zinc-200">
        Type
        <select
          id={`${idPrefix}-kind`}
          name="knowledge-kind"
          value={value.kind}
          onChange={(event) => onChange({
            ...value,
            kind: event.target.value as KnowledgeEntryKind,
            question: event.target.value === "faq" ? value.question : "",
          })}
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400"
        >
          <option value="faq">FAQ</option>
          <option value="note">Business note</option>
        </select>
      </label>

      <label htmlFor={`${idPrefix}-title`} className="space-y-2 text-sm font-medium text-zinc-200">
        Title
        <input
          id={`${idPrefix}-title`}
          name="knowledge-title"
          required
          maxLength={KNOWLEDGE_TITLE_MAX_LENGTH}
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="Example: Opening hours"
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-400"
        />
      </label>

      {value.kind === "faq" ? (
        <label htmlFor={`${idPrefix}-question`} className="space-y-2 text-sm font-medium text-zinc-200">
          Customer question
          <input
            id={`${idPrefix}-question`}
            name="knowledge-question"
            required
            maxLength={KNOWLEDGE_QUESTION_MAX_LENGTH}
            value={value.question}
            onChange={(event) => onChange({ ...value, question: event.target.value })}
            placeholder="When are you open?"
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-400"
          />
        </label>
      ) : null}

      <label htmlFor={`${idPrefix}-content`} className="space-y-2 text-sm font-medium text-zinc-200">
        {value.kind === "faq" ? "Verified answer" : "Business note"}
        <textarea
          id={`${idPrefix}-content`}
          name="knowledge-content"
          required
          rows={5}
          maxLength={KNOWLEDGE_CONTENT_MAX_LENGTH}
          value={value.content}
          onChange={(event) => onChange({ ...value, content: event.target.value })}
          placeholder={value.kind === "faq" ? "We are open Monday to Friday, 9 AM to 5 PM." : "Add a reviewed business fact or policy."}
          className="mt-2 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-400"
        />
      </label>

      <label htmlFor={`${idPrefix}-verified`} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
        <input
          id={`${idPrefix}-verified`}
          name="knowledge-verified"
          type="checkbox"
          checked={value.verified}
          onChange={(event) => onChange({ ...value, verified: event.target.checked })}
          className="mt-1 h-4 w-4 accent-emerald-500"
        />
        <span>
          <strong className="block text-zinc-100">I reviewed this information</strong>
          Only verified entries can be used by the safe test sandbox or reply-drafting runtime.
        </span>
      </label>
    </div>
  );
}

function KnowledgeEntryCard({
  employeeId,
  entry,
  onUpdated,
  onDeleted,
}: {
  employeeId: string;
  entry: KnowledgeEntry;
  onUpdated: (entry: KnowledgeEntry) => void;
  onDeleted: (entryId: string) => void;
}) {
  const [draft, setDraft] = useState<KnowledgeEntryInput>({
    kind: entry.kind,
    title: entry.title,
    question: entry.question,
    content: entry.content,
    verified: entry.verified,
  });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage({ type: "error", text: "Structured knowledge is temporarily unavailable. Please try again later." });
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await updateKnowledgeEntry(supabase, employeeId, entry.id, draft);
    setBusy(false);

    if (result.error || !result.data) {
      setMessage({ type: "error", text: result.error ?? "Could not update this entry." });
      return;
    }

    onUpdated(result.data);
    setEditing(false);
    setMessage({ type: "success", text: "Knowledge entry saved." });
  }

  async function remove() {
    if (!window.confirm(`Delete “${entry.title}”? This cannot be undone.`)) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage({ type: "error", text: "Structured knowledge is temporarily unavailable. Please try again later." });
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await deleteKnowledgeEntry(supabase, employeeId, entry.id);
    setBusy(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    onDeleted(entry.id);
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">
              {entry.kind}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${entry.verified ? "border-emerald-800 bg-emerald-950/40 text-emerald-200" : "border-amber-800 bg-amber-950/40 text-amber-200"}`}>
              {entry.verified ? "Verified" : "Draft — not used by AI"}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold">{entry.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          disabled={busy}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {editing ? "Cancel editing" : "Edit"}
        </button>
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-4" aria-busy={busy}>
          <KnowledgeFields idPrefix={`knowledge-entry-${entry.id}`} value={draft} onChange={setDraft} />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="rounded-xl bg-zinc-100 px-4 py-2 font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save entry"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              aria-busy={busy}
              className="rounded-xl border border-red-900 bg-red-950/30 px-4 py-2 font-semibold text-red-200 transition hover:bg-red-950/60 disabled:opacity-60"
            >
              Delete entry
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3 text-sm">
          {entry.kind === "faq" ? (
            <div>
              <p className="text-zinc-500">Question</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-100">{entry.question}</p>
            </div>
          ) : null}
          <div>
            <p className="text-zinc-500">{entry.kind === "faq" ? "Answer" : "Note"}</p>
            <p className="mt-1 whitespace-pre-wrap text-zinc-100">{entry.content}</p>
          </div>
        </div>
      )}

      {message ? <SettingsFeedback id={`knowledge-entry-${entry.id}-feedback`} message={message} /> : null}
    </Card>
  );
}

export default function StructuredKnowledgeManager({
  employeeId,
  initialEntries,
}: {
  employeeId: string;
  initialEntries: KnowledgeEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [draft, setDraft] = useState<KnowledgeEntryInput>(emptyInput);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage({ type: "error", text: "Structured knowledge is temporarily unavailable. Please try again later." });
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = await createKnowledgeEntry(supabase, employeeId, draft);
    setBusy(false);

    if (result.error || !result.data) {
      setMessage({ type: "error", text: result.error ?? "Could not create this entry." });
      return;
    }

    setEntries((current) => [result.data!, ...current]);
    setDraft(emptyInput);
    setMessage({ type: "success", text: "Knowledge entry created." });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Add structured knowledge</h2>
          <p className="mt-1 text-zinc-400">
            Add reviewed FAQs and business notes. No file upload, crawling, embeddings, or hidden ingestion occurs in Knowledge v0.
          </p>
        </div>
        <form onSubmit={create} className="space-y-4" aria-busy={busy}>
          <KnowledgeFields idPrefix="new-knowledge-entry" value={draft} onChange={setDraft} />
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="rounded-xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create knowledge entry"}
          </button>
        </form>
        {message ? <SettingsFeedback id="structured-knowledge-feedback" message={message} /> : null}
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Saved knowledge</h2>
          <p className="mt-1 text-zinc-400">{entries.length} of 50 retained entries shown.</p>
        </div>
        {entries.length === 0 ? (
          <Card className="space-y-2">
            <h3 className="text-lg font-semibold">No structured knowledge yet</h3>
            <p className="text-zinc-400">Create a draft, review it, then explicitly mark it verified before AI use.</p>
          </Card>
        ) : entries.map((entry) => (
          <KnowledgeEntryCard
            key={entry.id}
            employeeId={employeeId}
            entry={entry}
            onUpdated={(updated) => setEntries((current) => current.map((item) => item.id === updated.id ? updated : item))}
            onDeleted={(entryId) => {
              setEntries((current) => current.filter((item) => item.id !== entryId));
              setMessage({ type: "success", text: "Knowledge entry deleted." });
            }}
          />
        ))}
      </div>
    </div>
  );
}
