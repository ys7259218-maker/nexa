import type { Metadata } from "next";
import {
  describeOutboundReadiness,
  isOutboundSendReady,
  parseOutboundConfig,
} from "@/lib/outbound/whatsappSender";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Outbound readiness | Nexa AI" };

export default async function OutboundReadinessPage() {
  await requireAuthenticatedUser();
  const config = parseOutboundConfig();
  const ready = isOutboundSendReady(config);
  const items = describeOutboundReadiness(config);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Settings</p>
          <h1 className="mt-2 text-4xl font-bold">Outbound readiness</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Secret-free status of the WhatsApp outbound pipeline. Values are checked here, but never displayed.
          </p>
        </div>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-400" : "bg-rose-400"}`}
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold">{ready ? "Ready to send" : "Not ready to send"}</h2>
          </div>
          <p className="text-sm text-zinc-400">
            {ready
              ? "Approved drafts can reach WhatsApp in this deployment."
              : "At least one requirement below is unmet; sending stays disabled until every check passes."}
          </p>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-xl font-semibold">Requirement checks</h2>
          {items.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4 border-b border-zinc-800 py-3 last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${item.ready ? "bg-emerald-400" : "bg-rose-400"}`}
                    aria-hidden="true"
                  />
                  <p className="font-medium text-zinc-200">{item.label}</p>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{item.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.ready ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
                {item.ready ? "OK" : "Needs action"}
              </span>
            </div>
          ))}
          <p className="mt-2 text-xs text-zinc-600">Read-only configuration health check. Credential values are never shown.</p>
        </Card>
      </div>
    </AppLayout>
  );
}