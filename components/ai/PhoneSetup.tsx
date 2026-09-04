"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { phoneFieldCompleteness, PHONE_FIELDS, updateAIEmployee, type AIEmployee } from "@/lib/aiEmployees";
import SettingsFeedback, { type SettingsMessage } from "./SettingsFeedback";

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
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  const phoneFields = phoneFieldCompleteness({
    phone,
    country,
    business_hours: businessHours,
    call_forwarding_number: callForwardingNumber,
    call_routing_rule: callRoutingRule,
  });
  const phoneTotal = PHONE_FIELDS.length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage({ type: "error", text: "Phone metadata is temporarily unavailable. Please try again later." });
      return;
    }

    setMessage(null);
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
      setMessage({ type: "error", text: "Could not save phone metadata. Please review the values and try again." });
      return;
    }

    setMessage({ type: "success", text: "Phone metadata saved." });

    router.refresh();
  }

  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Phone Setup
        </h2>

        <p className="text-zinc-400 mt-1">
          Save phone and routing metadata for future telephony setup.
        </p>
        <p className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          Metadata only: Nexa cannot place, receive, forward, or route calls yet.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">Phone metadata</span>
          <span className="text-zinc-500">{phoneFields.filled}/{phoneTotal} complete</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PHONE_FIELDS.map((field, index) => {
            const stateValues = [phone, country, businessHours, callForwardingNumber, callRoutingRule];
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

        <div><label htmlFor="phone-business" className="mb-1.5 block text-sm font-medium text-zinc-200">Business Phone Number</label><Input id="phone-business" name="business-phone" type="tel" autoComplete="tel" placeholder="Business Phone Number" maxLength={200} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>

        <div><label htmlFor="phone-country" className="mb-1.5 block text-sm font-medium text-zinc-200">Country</label><Input id="phone-country" name="country" placeholder="Country" maxLength={200} value={country} onChange={(e) => setCountry(e.target.value)} /></div>

        <div><label htmlFor="phone-hours" className="mb-1.5 block text-sm font-medium text-zinc-200">Business Hours</label><Input id="phone-hours" name="business-hours" placeholder="Business Hours" maxLength={500} value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} /></div>

        <div><label htmlFor="phone-forwarding" className="mb-1.5 block text-sm font-medium text-zinc-200">Call Forwarding Number</label><Input id="phone-forwarding" name="call-forwarding-number" type="tel" placeholder="Call Forwarding Number" maxLength={200} value={callForwardingNumber} onChange={(e) => setCallForwardingNumber(e.target.value)} /></div>

        <div><label htmlFor="phone-routing" className="mb-1.5 block text-sm font-medium text-zinc-200">Call Routing Rule</label><Input id="phone-routing" name="call-routing-rule" placeholder="Call Routing Rule" maxLength={500} value={callRoutingRule} onChange={(e) => setCallRoutingRule(e.target.value)} /></div>

        {message ? <SettingsFeedback id="phone-settings-feedback" message={message} /> : null}

        <div className="pt-2">
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving ? "Saving..." : "Save phone metadata"}
          </Button>
        </div>

      </form>

    </Card>
  );
}
