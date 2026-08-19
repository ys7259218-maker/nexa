"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

type VoiceSettingsProps = {
  employeeId: string;
};

export default function VoiceSettings({
  employeeId,
}: VoiceSettingsProps) {
  const [voice, setVoice] = useState("");
  const [language, setLanguage] = useState("");
  const [accent, setAccent] = useState("");
  const [speakingStyle, setSpeakingStyle] =
    useState("");
  const [speakingSpeed, setSpeakingSpeed] =
    useState("");
  const [emotionTone, setEmotionTone] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      if (!employeeId) return;

      setLoading(true);
      setMessage("");

      const {
        data: employee,
        error: employeeError,
      } = await supabase
        .from("ai_employees")
        .select("voice, language")
        .eq("id", employeeId)
        .maybeSingle();

      if (employeeError) {
        console.error(
          "Voice employee load error:",
          employeeError
        );
      }

      const {
        data: settings,
        error: settingsError,
      } = await supabase
        .from("ai_employee_voice_settings")
        .select(
          "accent, speaking_style, speaking_speed, emotion_tone"
        )
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (settingsError) {
        console.error(
          "Voice settings load error:",
          settingsError
        );
      }

      if (employee) {
        setVoice(employee.voice || "");
        setLanguage(employee.language || "");
      }

      if (settings) {
        setAccent(settings.accent || "");

        setSpeakingStyle(
          settings.speaking_style || ""
        );

        setSpeakingSpeed(
          settings.speaking_speed || ""
        );

        setEmotionTone(
          settings.emotion_tone || ""
        );
      }

      setLoading(false);
    }

    loadSettings();
  }, [employeeId]);

  async function saveSettings() {
    if (!employeeId) return;

    setSaving(true);
    setMessage("");

    try {
      const {
        error: employeeError,
      } = await supabase
        .from("ai_employees")
        .update({
          voice,
          language,
        })
        .eq("id", employeeId);

      if (employeeError) {
        throw employeeError;
      }

      const {
        error: settingsError,
      } = await supabase
        .from("ai_employee_voice_settings")
        .upsert(
          {
            employee_id: employeeId,
            accent,
            speaking_style: speakingStyle,
            speaking_speed: speakingSpeed,
            emotion_tone: emotionTone,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "employee_id",
          }
        );

      if (settingsError) {
        throw settingsError;
      }

      setMessage(
        "Voice settings saved successfully."
      );
    } catch (error) {
      console.error(
        "Voice settings save error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save voice settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-zinc-400">
          Loading voice settings...
        </p>
      </Card>
    );
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

      <Input
        placeholder="Voice Name"
        value={voice}
        onChange={(e) =>
          setVoice(e.target.value)
        }
      />

      <Input
        placeholder="Language"
        value={language}
        onChange={(e) =>
          setLanguage(e.target.value)
        }
      />

      <Input
        placeholder="Accent"
        value={accent}
        onChange={(e) =>
          setAccent(e.target.value)
        }
      />

      <Input
        placeholder="Speaking Style"
        value={speakingStyle}
        onChange={(e) =>
          setSpeakingStyle(e.target.value)
        }
      />

      <Input
        placeholder="Speaking Speed"
        value={speakingSpeed}
        onChange={(e) =>
          setSpeakingSpeed(e.target.value)
        }
      />

      <Input
        placeholder="Emotion / Tone"
        value={emotionTone}
        onChange={(e) =>
          setEmotionTone(e.target.value)
        }
      />

      <div className="pt-2">
        <Button
          onClick={saveSettings}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save Voice Settings"}
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