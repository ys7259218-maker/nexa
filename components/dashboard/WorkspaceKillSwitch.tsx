"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../ui/Card";
import Button from "../ui/Button";
import SettingsFeedback, { type SettingsMessage } from "../ai/SettingsFeedback";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { setWorkspaceAutomationPaused, type WorkspaceSafetyState } from "@/lib/workspaceSafety";
import { canManageWorkspace } from "@/lib/workspaces";

export default function WorkspaceKillSwitch({ state }: { state: WorkspaceSafetyState }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const canManage = canManageWorkspace(state.role);

  async function toggle() {
    if (!canManage) return;
    const next = !state.automationPaused;
    if (!next && !confirm("Resume workspace automation? Individual employee and channel safety gates still apply.")) return;
    const client = createSupabaseBrowserClient();
    if (!client) {
      setMessage({ type: "error", text: "Workspace safety controls are temporarily unavailable. Please try again later." });
      return;
    }

    setSaving(true);
    setMessage(null);
    const result = await setWorkspaceAutomationPaused(client, state.id, next);
    setSaving(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({
      type: "success",
      text: next
        ? "Workspace automation paused. Inbound history may still be stored, but AI drafts remain blocked."
        : "Workspace automation permitted. Individual employee and channel safety gates still apply.",
    });
    router.refresh();
  }

  return (
    <Card className="flex flex-col items-stretch gap-4 border-amber-900/50 sm:flex-row sm:items-center sm:justify-between sm:gap-6" aria-busy={saving}>
      <div className="min-w-0">
        <p className="text-sm text-zinc-500">Workspace safety</p>
        <h2 className="text-xl font-semibold">{state.automationPaused ? "Automation paused" : "Automation permitted"}</h2>
        <p className="mt-1 text-sm text-zinc-400">{state.name} · {canManage ? "Owner/Admin control" : "Read-only"}</p>
        {message ? <SettingsFeedback id="workspace-safety-feedback" message={message} /> : null}
      </div>
      <Button
        className="w-full shrink-0 sm:w-auto"
        variant={state.automationPaused ? "secondary" : "danger"}
        disabled={!canManage || saving}
        aria-busy={saving}
        onClick={toggle}
      >
        {saving ? "Updating safety…" : state.automationPaused ? "Resume automation" : "Pause all automation"}
      </Button>
    </Card>
  );
}
