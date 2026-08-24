"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  saveWhatsAppChannel,
  type WhatsAppChannel,
} from "@/lib/whatsappChannels";

interface WhatsAppSetupProps {
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
  webhookConfigured,
  inboundReady,
  channels,
}: WhatsAppSetupProps) {
  const router = useRouter();

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      alert("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setSaving(true);

    const result = await saveWhatsAppChannel(supabase, {
      phoneNumberId,
      displayName,
    });

    setSaving(false);

    if (result.error) {
      alert("❌ " + result.error);
      return;
    }

    alert("✅ WhatsApp channel linked");
    setPhoneNumberId("");
    setDisplayName("");
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
                <span className="text-white">{channel.display_name || "WhatsApp channel"}</span>
                <span className="ml-2 font-mono text-xs text-zinc-400">
                  ID {channel.phone_number_id}
                </span>
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
            {saving ? "Linking..." : "Link WhatsApp Number"}
          </Button>
        </div>

      </form>

    </Card>
  );
}
