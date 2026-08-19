"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

type WhatsAppSetupProps = {
  employeeId: string;
};

export default function WhatsAppSetup({
  employeeId,
}: WhatsAppSetupProps) {
  const [whatsappNumber, setWhatsappNumber] =
    useState("");
  const [businessName, setBusinessName] =
    useState("");
  const [welcomeMessage, setWelcomeMessage] =
    useState("");
  const [awayMessage, setAwayMessage] =
    useState("");
  const [autoReplyMessage, setAutoReplyMessage] =
    useState("");
  const [workingHours, setWorkingHours] =
    useState("");

  const [connectionStatus, setConnectionStatus] =
    useState("not_connected");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      if (!employeeId) return;

      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("ai_employee_whatsapp_settings")
        .select(
          "whatsapp_business_number, business_name, welcome_message, away_message, auto_reply_message, working_hours, connection_status"
        )
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error) {
        console.error(
          "WhatsApp settings load error:",
          error
        );

        setMessage(error.message);
      }

      if (data) {
        setWhatsappNumber(
          data.whatsapp_business_number || ""
        );

        setBusinessName(
          data.business_name || ""
        );

        setWelcomeMessage(
          data.welcome_message || ""
        );

        setAwayMessage(
          data.away_message || ""
        );

        setAutoReplyMessage(
          data.auto_reply_message || ""
        );

        setWorkingHours(
          data.working_hours || ""
        );

        setConnectionStatus(
          data.connection_status ||
            "not_connected"
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
      const { error } = await supabase
        .from("ai_employee_whatsapp_settings")
        .upsert(
          {
            employee_id: employeeId,
            whatsapp_business_number:
              whatsappNumber,
            business_name: businessName,
            welcome_message:
              welcomeMessage,
            away_message: awayMessage,
            auto_reply_message:
              autoReplyMessage,
            working_hours: workingHours,
            connection_status:
              connectionStatus,
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
        "WhatsApp settings saved successfully."
      );
    } catch (error) {
      console.error(
        "WhatsApp settings save error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save WhatsApp settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-zinc-400">
          Loading WhatsApp settings...
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          WhatsApp Setup
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure your AI Employee WhatsApp
          Business account.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-zinc-800 p-4">
        <span className="text-zinc-400">
          Connection Status
        </span>

        <span
          className={
            connectionStatus === "connected"
              ? "text-green-400 font-semibold"
              : "text-zinc-400 font-semibold"
          }
        >
          {connectionStatus === "connected"
            ? "🟢 Connected"
            : "⚪ Not Connected"}
        </span>
      </div>

      <Input
        placeholder="WhatsApp Business Number"
        value={whatsappNumber}
        onChange={(e) =>
          setWhatsappNumber(e.target.value)
        }
      />

      <Input
        placeholder="Business Name"
        value={businessName}
        onChange={(e) =>
          setBusinessName(e.target.value)
        }
      />

      <Input
        placeholder="Welcome Message"
        value={welcomeMessage}
        onChange={(e) =>
          setWelcomeMessage(e.target.value)
        }
      />

      <Input
        placeholder="Away Message"
        value={awayMessage}
        onChange={(e) =>
          setAwayMessage(e.target.value)
        }
      />

      <Input
        placeholder="Auto Reply Message"
        value={autoReplyMessage}
        onChange={(e) =>
          setAutoReplyMessage(e.target.value)
        }
      />

      <Input
        placeholder="Working Hours"
        value={workingHours}
        onChange={(e) =>
          setWorkingHours(e.target.value)
        }
      />

      <div className="pt-2">
        <Button
          onClick={saveSettings}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save WhatsApp Settings"}
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