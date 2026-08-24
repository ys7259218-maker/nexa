"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../ui/Button";
import { updateAIEmployee, type AIEmployee } from "@/lib/aiEmployees";
import { allowedLifecycleTransitions, lifecyclePatch, validateLifecycleTransition, type EmployeeLifecycleStatus } from "@/lib/employeeLifecycle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LifecycleControls({ employee, activationReady, enabled }: { employee: AIEmployee; activationReady: boolean; enabled: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const current = employee.lifecycle_status ?? "Draft";

  async function transition(to: EmployeeLifecycleStatus) {
    const validationError = validateLifecycleTransition({ from: current, to, activationReady });
    if (validationError) { setMessage(validationError); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setMessage("Lifecycle controls are temporarily unavailable."); return; }
    setSaving(true); setMessage("");
    const result = await updateAIEmployee(supabase, employee.id, lifecyclePatch(to));
    setSaving(false);
    if (result.error) { setMessage("Could not update the employee lifecycle."); return; }
    router.refresh();
  }

  if (!enabled) return <p className="text-sm text-amber-300">Lifecycle migration is not enabled yet. Employee remains safely in legacy offline mode.</p>;

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-5">
      <div className="flex items-center justify-between"><span>Lifecycle</span><span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">{current}</span></div>
      <div className="flex flex-wrap gap-2">
        {allowedLifecycleTransitions(current).map((status) => (
          <Button key={status} type="button" variant={status === "Paused" ? "danger" : "secondary"} disabled={saving || (status === "Active" && !activationReady)} onClick={() => transition(status)}>
            {status === "Paused" ? "Emergency pause" : `Move to ${status}`}
          </Button>
        ))}
      </div>
      {message ? <p role="alert" className="text-sm text-amber-300">{message}</p> : null}
    </div>
  );
}
