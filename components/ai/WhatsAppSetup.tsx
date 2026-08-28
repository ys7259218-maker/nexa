"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  assignWhatsAppChannel,
  saveWhatsAppChannel,
  type WhatsAppChannel,
} from "@/lib/whatsappChannels";

interface WhatsAppSetupProps {
  employeeId: string;
  assignmentEnabled: boolean;
  webhookConfigured: boolean;
  inboundReady: boolean;
  channels: WhatsAppChannel[];
}

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean | null;
  label: string;
  detail: string;
}) {
  const color =
    ok === null
      ? "bg-amber-400"
      : ok
        ? "bg-emerald-400"
        : "bg-red-400";

  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm text-zinc-400">{detail}</p>
      </div>
    </div>
  );
}

export default function WhatsAppSetup({
  employeeId,
  assignmentEnabled,
  webhookConfigured,
  inboundReady,
  channels,
}: WhatsAppSetupProps) {
  const router = useRouter();

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigningChannelId, setAssigningChannelId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      alert("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setSaving(true);
    setFeedback(null);

    const result = await saveWhatsAppChannel(supabase, {
      phoneNumberId,
      displayName,
      ...(assignmentEnabled ? { employeeId } : {}),
    });

    setSaving(false);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    setFeedback(
      assignmentEnabled
        ? "WhatsApp channel linked and assigned to this AI Employee."
        : "WhatsApp channel linked. AI assignment remains safely disabled.",
    );
    setPhoneNumberId("");
    setDisplayName("");
    router.refresh();
  }

  async function handleAssign(channelId: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setFeedback("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setAssigningChannelId(channelId);
    setFeedback(null);
    const result = await assignWhatsAppChannel(supabase, channelId, employeeId);
    setAssigningChannelId(null);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    setFeedback("WhatsApp channel assigned to this AI Employee.");
    router.refresh();
  }

  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          WhatsApp Setup
        </h2>

        <p className="text-zinc-400 mt-1">
          Connect your WhatsApp Business number and check pipeline status.
        </p>
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-300">
          Meta phone-number registration is pending. Inbound events are processed
          with a safe mock AI reply; production outbound sending stays disabled.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <StatusRow
          ok={webhookConfigured}
          label={webhookConfigured ? "Webhook configured" : "Webhook not configured"}
          detail={
            webhookConfigured
              ? "Signed webhook endpoint and verification token are set on the server."
              : "Set WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET on the server to accept Meta webhooks."
          }
        />

        <StatusRow
          ok={inboundReady}
          label={inboundReady ? "Inbound processing ready" : "Inbound processing not ready"}
          detail={
            inboundReady
              ? "Events are deduplicated, stored as conversations, and answered by the mock AI provider."
              : "Set SUPABASE_SERVICE_ROLE_KEY (server only) so the processor can store conversations."
          }
        />

        <StatusRow
          ok={
            assignmentEnabled
              ? channels.some((channel) => channel.ai_employee_id === employeeId)
              : null
          }
          label={
            !assignmentEnabled
              ? "AI assignment rollout disabled"
              : channels.some((channel) => channel.ai_employee_id === employeeId)
                ? "Channel assigned to this AI Employee"
                : "No channel assigned to this AI Employee"
          }
          detail={
            !assignmentEnabled
              ? "Inbound messages can be stored, but no AI draft is generated until the reviewed migration and live safety tests pass."
              : channels.some((channel) => channel.ai_employee_id === employeeId)
                ? "Only this employee's verified context can be used for drafts from the assigned channel."
                : "Assign a linked channel below. Unassigned channels store inbound messages without generating an AI draft."
          }
        />

        <StatusRow
          ok={false}
          label="Outbound sending blocked by Meta"
          detail="Replies are stored as drafts until the phone number passes Meta registration and WHATSAPP_OUTBOUND_ENABLED is turned on."
        />
      </div>

      {channels.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-300">Linked channels</h3>
          <ul className="space-y-2">
            {channels.map((channel) => (
              <li
                key={channel.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-white">{channel.display_name || "WhatsApp channel"}</span>
                    <span className="ml-2 font-mono text-xs text-zinc-400">
                      ID {channel.phone_number_id}
                    </span>
                    {assignmentEnabled ? (
                      <p className="mt-1 text-xs text-zinc-400">
                        {channel.ai_employee_id === employeeId
                          ? "Assigned to this AI Employee"
                          : channel.ai_employee_id
                            ? "Assigned to another AI Employee"
                            : "Unassigned — inbound storage only; no AI draft"}
                      </p>
                    ) : null}
                  </div>
                  {assignmentEnabled && channel.ai_employee_id !== employeeId ? (
                    <Button
                      type="button"
                      disabled={assigningChannelId !== null}
                      onClick={() => handleAssign(channel.id)}
                    >
                      {assigningChannelId === channel.id ? "Assigning..." : "Assign here"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Input
          placeholder="Meta Phone Number ID (from your WhatsApp account)"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          required
        />

        <Input
          placeholder="Display Name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div className="pt-2">
          <Button type="submit" disabled={saving}>
            {saving
              ? "Linking..."
              : assignmentEnabled
                ? "Link and assign to this employee"
                : "Link WhatsApp Number"}
          </Button>
        </div>

        {feedback ? (
          <p className="text-sm text-zinc-300" role="status">
            {feedback}
          </p>
        ) : null}

      </form>

    </Card>
  );
}
