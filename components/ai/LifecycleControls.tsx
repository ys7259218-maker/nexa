"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../ui/Button";
import SettingsFeedback, { type SettingsMessage } from "./SettingsFeedback";
import type { AIEmployee } from "@/lib/aiEmployees";
import { allowedLifecycleTransitions, validateLifecycleTransition, type EmployeeLifecycleStatus } from "@/lib/employeeLifecycle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LifecycleControls({ employee, activationReady, enabled }: { employee: AIEmployee; activationReady: boolean; enabled: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const current = employee.lifecycle_status ?? "Draft";

  async function transition(to: EmployeeLifecycleStatus) {
    const validationError = validateLifecycleTransition({ from: current, to, activationReady });
    if (validationError) { setMessage({ type: "error", text: validationError }); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setMessage({ type: "error", text: "Lifecycle controls are temporarily unavailable. Please try again later." }); return; }
    setSaving(true); setMessage(null);
    const { error } = await supabase.rpc("transition_ai_employee_lifecycle", {
      target_employee_id: employee.id,
      target_status: to,
    });
    setSaving(false);
    if (error) { setMessage({ type: "error", text: "Could not update the employee lifecycle." }); return; }
    setMessage({
      type: "success",
      text: to === "Active"
        ? "Employee moved to Active. Higher-level workspace and channel safety gates still apply."
        : `Employee moved to ${to}. Automation remains paused for this employee.`,
    });
    router.refresh();
  }

  if (!enabled) return <p className="text-sm text-amber-300">Lifecycle migration is not enabled yet. Employee remains safely in legacy offline mode.</p>;

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-5" aria-busy={saving}>
      <div className="flex items-center justify-between"><span>Lifecycle</span><span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">{current}</span></div>
      <div className="flex flex-wrap gap-2">
        {allowedLifecycleTransitions(current).map((status) => (
          <Button key={status} type="button" variant={status === "Paused" ? "danger" : "secondary"} disabled={saving || (status === "Active" && !activationReady)} aria-busy={saving} onClick={() => transition(status)}>
            {status === "Paused" ? "Emergency pause" : `Move to ${status}`}
          </Button>
        ))}
      </div>
      {allowedLifecycleTransitions(current).includes("Active") && !activationReady ? (
        <p className="text-sm text-amber-300">
          Moving to Active is locked until every activation requirement shows verified
          evidence and the trusted server verification workflow is connected.
        </p>
      ) : null}
      {message ? <SettingsFeedback id="lifecycle-feedback" message={message} /> : null}
    </div>
  );
}
