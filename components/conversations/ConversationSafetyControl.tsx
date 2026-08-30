"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hand, ShieldAlert } from "lucide-react";

import Button from "@/components/ui/Button";
import SettingsFeedback, { type SettingsMessage } from "@/components/ai/SettingsFeedback";
import {
  setConversationHumanTakeover,
  type ConversationAutomationMode,
} from "@/lib/conversationSafety";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { canOperateWorkspace, type WorkspaceRole } from "@/lib/workspaces";

type ConversationSafetyControlProps = {
  workspaceId: string;
  conversationId: string;
  automationMode: ConversationAutomationMode;
  customerOptedOutAt: string | null;
  role: WorkspaceRole | null;
};

export default function ConversationSafetyControl({
  workspaceId,
  conversationId,
  automationMode,
  customerOptedOutAt,
  role,
}: ConversationSafetyControlProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const optedOut = customerOptedOutAt !== null;
  const humanMode = automationMode === "human";
  const canOperate = role !== null && canOperateWorkspace(role);

  async function toggleHumanTakeover() {
    if (!canOperate || optedOut) return;
    const nextEnabled = !humanMode;
    if (!nextEnabled && !confirm("Return this conversation to AI draft eligibility? Workspace, employee, and channel safety gates still apply.")) {
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setMessage({ type: "error", text: "Conversation safety controls are temporarily unavailable. Please try again later." });
      return;
    }

    setSaving(true);
    setMessage(null);
    const result = await setConversationHumanTakeover(
      client,
      workspaceId,
      conversationId,
      nextEnabled,
    );
    setSaving(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({
      type: "success",
      text: nextEnabled
        ? "Human takeover enabled. Inbound history may still be stored, but AI drafts remain blocked for this conversation."
        : "Conversation returned to AI draft eligibility. Workspace, employee, channel, and opt-out safety gates still apply.",
    });
    router.refresh();
  }

  const status = optedOut
    ? {
        icon: <ShieldAlert size={15} />,
        label: "Customer opted out",
        detail: "AI drafts remain blocked. Opt-out cannot be cleared from this screen.",
        classes: "border-red-400/20 bg-red-400/10 text-red-200",
      }
    : humanMode
      ? {
          icon: <Hand size={15} />,
          label: "Human takeover active",
          detail: "AI draft generation is paused for this conversation.",
          classes: "border-amber-400/20 bg-amber-400/10 text-amber-200",
        }
      : {
          icon: <ShieldAlert size={15} />,
          label: "AI draft eligible",
          detail: "All higher-level workspace, employee, and channel gates still apply.",
          classes: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
        };

  return (
    <div className="border-b border-white/10 px-6 py-4" aria-busy={saving}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={`rounded-2xl border px-4 py-3 text-sm ${status.classes}`}>
          <p className="flex items-center gap-2 font-medium">{status.icon}{status.label}</p>
          <p className="mt-1 text-xs opacity-80">{status.detail}</p>
        </div>
        <Button
          type="button"
          variant={humanMode ? "secondary" : "danger"}
          disabled={!canOperate || optedOut || saving}
          aria-busy={saving}
          onClick={toggleHumanTakeover}
          className="w-full sm:w-auto"
        >
          {saving ? "Updating…" : humanMode ? "Return to AI drafts" : "Take over conversation"}
        </Button>
      </div>
      {!canOperate ? (
        <p className="mt-2 text-xs text-zinc-500">Viewer access is read-only.</p>
      ) : null}
      {message ? <SettingsFeedback id="conversation-safety-feedback" message={message} /> : null}
    </div>
  );
}
