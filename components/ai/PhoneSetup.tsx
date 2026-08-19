"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

type PhoneSetupProps = {
  employeeId: string;
};

export default function PhoneSetup({
  employeeId,
}: PhoneSetupProps) {
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [callForwardingNumber, setCallForwardingNumber] =
    useState("");
  const [callRoutingRule, setCallRoutingRule] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      if (!employeeId) return;

      setLoading(true);
      setMessage("");

      const { data: employee } = await supabase
        .from("ai_employees")
        .select("phone")
        .eq("id", employeeId)
        .maybeSingle();

      const { data: settings, error } = await supabase
        .from("ai_employee_phone_settings")
        .select(
          "country, business_hours, call_forwarding_number, call_routing_rule"
        )
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (employee) {
        setPhone(employee.phone || "");
      }

      if (error) {
        console.error("Phone settings load error:", error);
      }

      if (settings) {
        setCountry(settings.country || "");
        setBusinessHours(settings.business_hours || "");
        setCallForwardingNumber(
          settings.call_forwarding_number || ""
        );
        setCallRoutingRule(
          settings.call_routing_rule || ""
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
      const { error: employeeError } = await supabase
        .from("ai_employees")
        .update({
          phone,
        })
        .eq("id", employeeId);

      if (employeeError) {
        throw employeeError;
      }

      const { error: settingsError } = await supabase
        .from("ai_employee_phone_settings")
        .upsert(
          {
            employee_id: employeeId,
            country,
            business_hours: businessHours,
            call_forwarding_number:
              callForwardingNumber,
            call_routing_rule: callRoutingRule,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "employee_id",
          }
        );

      if (settingsError) {
        throw settingsError;
      }

      setMessage("Phone settings saved successfully.");
    } catch (error) {
      console.error("Phone settings save error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save phone settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-zinc-400">
          Loading phone settings...
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Phone Setup
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure your AI Employee phone system.
        </p>
      </div>

      <Input
        placeholder="Business Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <Input
        placeholder="Country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
      />

      <Input
        placeholder="Business Hours"
        value={businessHours}
        onChange={(e) =>
          setBusinessHours(e.target.value)
        }
      />

      <Input
        placeholder="Call Forwarding Number"
        value={callForwardingNumber}
        onChange={(e) =>
          setCallForwardingNumber(e.target.value)
        }
      />

      <Input
        placeholder="Call Routing Rule"
        value={callRoutingRule}
        onChange={(e) =>
          setCallRoutingRule(e.target.value)
        }
      />

      <div className="pt-2">
        <Button
          onClick={saveSettings}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save Phone Settings"}
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