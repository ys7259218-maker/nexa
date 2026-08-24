"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateAIEmployee, type AIEmployee } from "@/lib/aiEmployees";

interface PhoneSetupProps {
  employee: AIEmployee;
}

export default function PhoneSetup({ employee }: PhoneSetupProps) {
  const router = useRouter();

  const [phone, setPhone] = useState(employee.phone);
  const [country, setCountry] = useState(employee.country);
  const [businessHours, setBusinessHours] = useState(employee.business_hours);
  const [callForwardingNumber, setCallForwardingNumber] = useState(
    employee.call_forwarding_number,
  );
  const [callRoutingRule, setCallRoutingRule] = useState(
    employee.call_routing_rule,
  );

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
      phone,
      country,
      business_hours: businessHours,
      call_forwarding_number: callForwardingNumber,
      call_routing_rule: callRoutingRule,
    });

    setSaving(false);

    if (result.error) {
      alert("❌ " + result.error);
      return;
    }

    alert("✅ Phone settings saved");

    router.refresh();
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

      <form onSubmit={handleSave} className="space-y-6">

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
          onChange={(e) => setBusinessHours(e.target.value)}
        />

        <Input
          placeholder="Call Forwarding Number"
          value={callForwardingNumber}
          onChange={(e) => setCallForwardingNumber(e.target.value)}
        />

        <Input
          placeholder="Call Routing Rule"
          value={callRoutingRule}
          onChange={(e) => setCallRoutingRule(e.target.value)}
        />


        <div className="pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Phone Settings"}
          </Button>
        </div>

      </form>

    </Card>
  );
}
