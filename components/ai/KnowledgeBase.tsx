"use client";

import { useState } from "react";
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

    alert("✅ Knowledge saved");

    router.refresh();
  }

  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Knowledge Base
        </h2>

        <p className="text-zinc-400 mt-1">
          Train your AI Employee with business knowledge.
        </p>
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
            {saving ? "Saving..." : "Save Knowledge"}
          </Button>
        </div>

      </form>

    </Card>
  );
}
