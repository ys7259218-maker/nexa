"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

type KnowledgeBaseProps = {
  employeeId: string;
};

export default function KnowledgeBase({
  employeeId,
}: KnowledgeBaseProps) {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [faq, setFaq] = useState("");
  const [businessNotes, setBusinessNotes] =
    useState("");
  const [knowledgeText, setKnowledgeText] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadKnowledge() {
      if (!employeeId) return;

      setLoading(true);
      setMessage("");

      const {
        data,
        error,
      } = await supabase
        .from("ai_employee_knowledge")
        .select(
          "website_url, faq, business_notes, knowledge_text"
        )
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error) {
        console.error(
          "Knowledge load error:",
          error
        );

        setMessage(error.message);
      }

      if (data) {
        setWebsiteUrl(data.website_url || "");
        setFaq(data.faq || "");
        setBusinessNotes(
          data.business_notes || ""
        );
        setKnowledgeText(
          data.knowledge_text || ""
        );
      }

      setLoading(false);
    }

    loadKnowledge();
  }, [employeeId]);

  async function saveKnowledge() {
    if (!employeeId) return;

    setSaving(true);
    setMessage("");

    try {
      const {
        error,
      } = await supabase
        .from("ai_employee_knowledge")
        .upsert(
          {
            employee_id: employeeId,
            website_url: websiteUrl,
            faq,
            business_notes: businessNotes,
            knowledge_text: knowledgeText,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "employee_id",
          }
        );

      if (error) {
        throw error;
      }

      setMessage(
        "Knowledge saved successfully."
      );
    } catch (error) {
      console.error(
        "Knowledge save error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save knowledge."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-zinc-400">
          Loading knowledge base...
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Knowledge Base
        </h2>

        <p className="text-zinc-400 mt-1">
          Train your AI Employee with business
          knowledge.
        </p>
      </div>

      <Input
        placeholder="Business Website URL"
        value={websiteUrl}
        onChange={(e) =>
          setWebsiteUrl(e.target.value)
        }
      />

      <textarea
        className="w-full min-h-40 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-white outline-none focus:border-zinc-600"
        placeholder="FAQ Document"
        value={faq}
        onChange={(e) =>
          setFaq(e.target.value)
        }
      />

      <textarea
        className="w-full min-h-40 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-white outline-none focus:border-zinc-600"
        placeholder="Business Notes"
        value={businessNotes}
        onChange={(e) =>
          setBusinessNotes(e.target.value)
        }
      />

      <textarea
        className="w-full min-h-40 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-white outline-none focus:border-zinc-600"
        placeholder="Additional Knowledge"
        value={knowledgeText}
        onChange={(e) =>
          setKnowledgeText(e.target.value)
        }
      />

      <div className="pt-2">
        <Button
          onClick={saveKnowledge}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save Knowledge"}
        </Button>
      </div>

      {message && (
        <p className="text-sm text-zinc-400">
          {message}
        </p>
      )}
    </Card>
  );
}