"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteAIEmployee,
  updateAIEmployee,
  type AIEmployee,
} from "@/lib/aiEmployees";

interface GeneralSettingsProps {
  employee: AIEmployee;
}

export default function GeneralSettings({ employee }: GeneralSettingsProps) {
  const router = useRouter();

  const [name, setName] = useState(employee.name);
  const [businessName, setBusinessName] = useState(employee.business_name);
  const [status, setStatus] = useState<"Active" | "Offline">(employee.status);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      alert("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setSaving(true);

    const result = await updateAIEmployee(supabase, employee.id, {
      name,
      business_name: businessName,
      status,
    });

    setSaving(false);

    if (result.error) {
      alert("❌ " + result.error);
      return;
    }

    alert("✅ Changes saved");

    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${employee.name}? This cannot be undone.`)) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      alert("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setDeleting(true);

    const result = await deleteAIEmployee(supabase, employee.id);

    setDeleting(false);

    if (result.error) {
      alert("❌ " + result.error);
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

      <form onSubmit={handleSave} className="space-y-6">

        <Input
          placeholder="AI Employee Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          placeholder="Business Name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
        />

        <select
          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={status}
          onChange={(e) => setStatus(e.target.value as "Active" | "Offline")}
        >
          <option value="Offline">Offline</option>
          <option value="Active">Active</option>
        </select>

        <div className="pt-2 flex items-center gap-4 flex-wrap">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? "Deleting..." : "Delete AI Employee"}
          </Button>
        </div>

      </form>
    </Card>
  );
}
