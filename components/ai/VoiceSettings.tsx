"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateAIEmployee, voiceFieldCompleteness, VOICE_FIELDS, type AIEmployee } from "@/lib/aiEmployees";
import SettingsFeedback, { type SettingsMessage } from "./SettingsFeedback";

interface VoiceSettingsProps {
  employee: AIEmployee;
}

export default function VoiceSettings({ employee }: VoiceSettingsProps) {
  const router = useRouter();

  const [voice, setVoice] = useState(employee.voice);
  const [language, setLanguage] = useState(employee.language);
  const [accent, setAccent] = useState(employee.accent);
  const [speakingStyle, setSpeakingStyle] = useState(employee.speaking_style);
  const [speakingSpeed, setSpeakingSpeed] = useState(employee.speaking_speed);
  const [tone, setTone] = useState(employee.tone);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  const voiceFields = voiceFieldCompleteness({
    voice,
    language,
    accent,
    speaking_style: speakingStyle,
    speaking_speed: speakingSpeed,
    tone,
  });
  const voiceTotal = VOICE_FIELDS.length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage({ type: "error", text: "Voice preferences are temporarily unavailable. Please try again later." });
      return;
    }

    setMessage(null);
    setSaving(true);

    const result = await updateAIEmployee(supabase, employee.id, {
      voice: voice.trim() || "Female",
      language: language.trim() || "English",
      accent,
      speaking_style: speakingStyle,
      speaking_speed: speakingSpeed,
      tone,
    });

    setSaving(false);

    if (result.error) {
      setMessage({ type: "error", text: "Could not save voice preferences. Please review the values and try again." });
      return;
    }

    setMessage({ type: "success", text: "Voice preferences saved." });

    router.refresh();
  }

  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Voice Settings
        </h2>

        <p className="text-zinc-400 mt-1">
          Save the intended language and speaking style for this AI Employee.
        </p>
        <p className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          Preferences only: no live voice or telephony provider is connected yet.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">Voice preferences</span>
          <span className="text-zinc-500">{voiceFields.filled}/{voiceTotal} complete</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {VOICE_FIELDS.map((field, index) => {
            const stateValues = [voice, language, accent, speakingStyle, speakingSpeed, tone];
            const filled = stateValues[index]?.trim().length > 0;
            return (
              <span
                key={field.key}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${filled ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}
              >
                {filled ? "✓ " : ""}{field.label}
              </span>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6" aria-busy={saving}>

        <div><label htmlFor="voice-name" className="mb-1.5 block text-sm font-medium text-zinc-200">Voice Name</label><Input id="voice-name" name="voice-name" placeholder="Voice Name" maxLength={200} value={voice} onChange={(e) => setVoice(e.target.value)} /></div>

        <div><label htmlFor="voice-language" className="mb-1.5 block text-sm font-medium text-zinc-200">Language</label><Input id="voice-language" name="language" placeholder="Language" maxLength={200} value={language} onChange={(e) => setLanguage(e.target.value)} /></div>

        <div><label htmlFor="voice-accent" className="mb-1.5 block text-sm font-medium text-zinc-200">Accent</label><Input id="voice-accent" name="accent" placeholder="Accent" maxLength={200} value={accent} onChange={(e) => setAccent(e.target.value)} /></div>

        <div><label htmlFor="voice-style" className="mb-1.5 block text-sm font-medium text-zinc-200">Speaking Style</label><Input id="voice-style" name="speaking-style" placeholder="Speaking Style" maxLength={200} value={speakingStyle} onChange={(e) => setSpeakingStyle(e.target.value)} /></div>

        <div><label htmlFor="voice-speed" className="mb-1.5 block text-sm font-medium text-zinc-200">Speaking Speed</label><Input id="voice-speed" name="speaking-speed" placeholder="Speaking Speed" maxLength={200} value={speakingSpeed} onChange={(e) => setSpeakingSpeed(e.target.value)} /></div>

        <div><label htmlFor="voice-tone" className="mb-1.5 block text-sm font-medium text-zinc-200">Emotion / Tone</label><Input id="voice-tone" name="tone" placeholder="Emotion / Tone" maxLength={200} value={tone} onChange={(e) => setTone(e.target.value)} /></div>

        {message ? <SettingsFeedback id="voice-settings-feedback" message={message} /> : null}

        <div className="pt-2">
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving ? "Saving…" : "Save voice preferences"}
          </Button>
        </div>

      </form>

    </Card>
  );
}
