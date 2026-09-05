"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteAIEmployee,
  identityFieldCompleteness,
  IDENTITY_FIELDS,
  updateAIEmployee,
  validateAIEmployeeInput,
  type AIEmployee,
} from "@/lib/aiEmployees";
import { recordActivityEvent } from "@/lib/dashboard";

interface GeneralSettingsProps {
  employee: AIEmployee;
}

export default function GeneralSettings({ employee }: GeneralSettingsProps) {
  const router = useRouter();

  const [name, setName] = useState(employee.name);
  const [businessName, setBusinessName] = useState(employee.business_name);
  const [department, setDepartment] = useState(employee.department);
  const [businessDescription, setBusinessDescription] = useState(
    employee.business_description,
  );
  const [greetingMessage, setGreetingMessage] = useState(
    employee.greeting_message,
  );
  const [timezone, setTimezone] = useState(employee.timezone);
  const [workingHours, setWorkingHours] = useState(employee.working_hours);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  const identity = identityFieldCompleteness({
    name,
    business_name: businessName,
    department,
  });
  const identityTotal = IDENTITY_FIELDS.length;

  useEffect(() => {
    feedbackRef.current?.focus();
  }, [message]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateAIEmployeeInput({
      name,
      business_name: businessName,
      department,
      business_description: businessDescription,
      greeting_message: greetingMessage,
      timezone,
      working_hours: workingHours,
    });
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage({ type: "error", text: "Settings are temporarily unavailable. Please try again later." });
      return;
    }

    setMessage(null);
    setSaving(true);

    const result = await updateAIEmployee(supabase, employee.id, {
      name,
      business_name: businessName,
      department,
      business_description: businessDescription,
      greeting_message: greetingMessage,
      timezone,
      working_hours: workingHours,
    });

    setSaving(false);

    if (result.error) {
      setMessage({ type: "error", text: "Could not save these settings. Please review the details and try again." });
      return;
    }

    setMessage({ type: "success", text: "General settings saved." });

    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${employee.name}? This cannot be undone.`)) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage({ type: "error", text: "Employee deletion is temporarily unavailable. Please try again later." });
      return;
    }

    setMessage(null);
    setDeleting(true);

    const result = await deleteAIEmployee(supabase, employee.id);

    if (!result.error) {
      await recordActivityEvent(supabase, {
        message: `${employee.name} was deleted`,
        category: "general",
      });
    }

    setDeleting(false);

    if (result.error) {
      setMessage({ type: "error", text: "Could not delete this AI Employee. Please try again later." });
      return;
    }

    router.refresh();
    router.push("/ai-employees");
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          General Settings
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure your AI Employee identity.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">Identity fields</span>
          <span className="text-zinc-500">{identity.filled}/{identityTotal} complete</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {IDENTITY_FIELDS.map((field) => {
            const filled = field.key === "name" ? name.trim().length > 0 : field.key === "business_name" ? businessName.trim().length > 0 : department.trim().length > 0;
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

      <form onSubmit={handleSave} className="space-y-6" aria-busy={saving || deleting}>

        <div>
          <label htmlFor="general-name" className="mb-1.5 block text-sm font-medium text-zinc-200">AI Employee Name</label>
          <Input
            id="general-name"
            name="name"
            placeholder="AI Employee Name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={message?.type === "error" ? "general-settings-feedback" : undefined}
          />
        </div>

        <div>
          <label htmlFor="general-business" className="mb-1.5 block text-sm font-medium text-zinc-200">Business Name</label>
          <Input
            id="general-business"
            name="business-name"
            placeholder="Business Name"
            maxLength={160}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={message?.type === "error" ? "general-settings-feedback" : undefined}
          />
        </div>

        <div>
          <label htmlFor="general-department" className="mb-1.5 block text-sm font-medium text-zinc-200">Department</label>
          <Input id="general-department" name="department" placeholder="Department" maxLength={200} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>

        <div>
          <label htmlFor="general-description" className="mb-1.5 block text-sm font-medium text-zinc-200">Business Description</label>
          <Input id="general-description" name="business-description" placeholder="Business Description" maxLength={500} value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} />
        </div>

        <div>
          <label htmlFor="general-greeting" className="mb-1.5 block text-sm font-medium text-zinc-200">Greeting Message</label>
          <Input id="general-greeting" name="greeting-message" placeholder="Greeting Message" maxLength={500} value={greetingMessage} onChange={(e) => setGreetingMessage(e.target.value)} />
        </div>

        <div>
          <label htmlFor="general-timezone" className="mb-1.5 block text-sm font-medium text-zinc-200">Timezone</label>
          <Input id="general-timezone" name="timezone" placeholder="Timezone" maxLength={200} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </div>

        <div>
          <label htmlFor="general-hours" className="mb-1.5 block text-sm font-medium text-zinc-200">Working Hours</label>
          <Input id="general-hours" name="working-hours" placeholder="Working Hours" maxLength={500} value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} />
        </div>

        {message ? (
          <p
            ref={feedbackRef}
            id="general-settings-feedback"
            role={message.type === "error" ? "alert" : "status"}
            aria-live={message.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            tabIndex={-1}
            className={message.type === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}
          >
            {message.text}
          </p>
        ) : null}

        <div className="pt-2 flex items-center gap-4 flex-wrap">
          <Button type="submit" disabled={saving || deleting} aria-busy={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={deleting || saving}
            aria-busy={deleting}
          >
            {deleting ? "Deleting…" : "Delete AI Employee"}
          </Button>
        </div>

      </form>
    </Card>
  );
}
