"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateAIEmployee, type AIEmployee } from "@/lib/aiEmployees";

interface VoiceSettingsProps {
  employee: AIEmployee;
}

export default function VoiceSettings({ employee }: VoiceSettingsProps) {
  const router = useRouter();

  const [voice, setVoice] = useState(employee.voice);
  const [language, setLanguage] = useState(employee.language);

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
      voice: voice.trim() || "Female",
      language: language.trim() || "English",
    });

    setSaving(false);

    if (result.error) {
      alert("❌ " + result.error);
      return;
    }

    alert("✅ Voice settings saved");

    router.refresh();
  }

  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Voice Settings
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure how your AI Employee speaks.
        </p>
      </div>


      <form onSubmit={handleSave} className="space-y-6">

        <Input
          placeholder="Voice Name"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
        />

        <Input
          placeholder="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        />

        <div className="pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Voice Settings"}
          </Button>
        </div>

      </form>

    </Card>
  );
}
