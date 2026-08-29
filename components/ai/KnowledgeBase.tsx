"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateAIEmployee, type AIEmployee } from "@/lib/aiEmployees";

interface KnowledgeBaseProps {
  employee: AIEmployee;
}

export default function KnowledgeBase({ employee }: KnowledgeBaseProps) {
  const router = useRouter();

  const [website, setWebsite] = useState(employee.knowledge_website);
  const [faqDocument, setFaqDocument] = useState(
    employee.knowledge_faq_document,
  );
  const [pdfUrl, setPdfUrl] = useState(employee.knowledge_pdf_url);
  const [notes, setNotes] = useState(employee.knowledge_notes);

  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      alert("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setSaving(true);

    const result = await updateAIEmployee(supabase, employee.id, {
      knowledge_website: website,
      knowledge_faq_document: faqDocument,
      knowledge_pdf_url: pdfUrl,
      knowledge_notes: notes,
    });

    setSaving(false);

    if (result.error) {
      alert("❌ " + result.error);
      return;
    }

    alert("✅ Knowledge references saved");

    router.refresh();
  }

  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Knowledge Base
        </h2>

        <p className="text-zinc-400 mt-1">
          Save source references and notes for future knowledge ingestion.
        </p>
        <p className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          Metadata only: Nexa does not crawl, upload, index, or retrieve these sources yet.
        </p>
        <Link
          href={`/ai-employees/${employee.id}/knowledge/sources`}
          className="mt-4 inline-flex rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Open Source Registry v1
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        <Input
          placeholder="Business Website URL"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />

        <Input
          placeholder="FAQ Document"
          value={faqDocument}
          onChange={(e) => setFaqDocument(e.target.value)}
        />

        <Input
          placeholder="Knowledge PDF"
          value={pdfUrl}
          onChange={(e) => setPdfUrl(e.target.value)}
        />

        <Input
          placeholder="Business Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save knowledge references"}
          </Button>
        </div>

      </form>

    </Card>
  );
}
