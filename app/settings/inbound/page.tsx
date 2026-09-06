import type { Metadata } from "next";
import { describeInboundReadiness, describeInboundWebhookUrl, isInboundReady } from "@/lib/inboundReadiness";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Inbound readiness | Nexa AI" };

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

export default async function InboundReadinessPage() {
  await requireAuthenticatedUser();
  const state = describeInboundReadiness();
  const webhookUrl = baseUrl ? describeInboundWebhookUrl(baseUrl) : null;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Settings</p>
          <h1 className="mt-2 text-4xl font-bold">Inbound readiness</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Secret-free status of the WhatsApp inbound webhook pipeline. Credential values are checked here, but never shown.
          </p>
        </div>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${isInboundReady(state) ? "bg-emerald-400" : "bg-rose-400"}`}
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold">{isInboundReady(state) ? "Ready to receive" : "Not ready to receive"}</h2>
          </div>
          <p className="text-sm text-zinc-400">
            {isInboundReady(state)
              ? "Meta webhooks can be verified and inbound messages can be stored in this deployment."
              : "At least one requirement below is unmet; the webhook stays unverified until every check passes."}
          </p>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-xl font-semibold">Requirement checks</h2>
          {state.items.map((item) => (
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
          {webhookUrl ? (
            <div className="border-t border-zinc-800 pt-3">
              <p className="text-xs text-zinc-500">Configure Meta&apos;s callback URL as:</p>
              <code className="mt-1 block break-all rounded-lg bg-zinc-900 px-3 py-2 text-xs text-cyan-300">{webhookUrl}</code>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-zinc-600">Read-only configuration health check. No secret values are ever shown.</p>
        </Card>
      </div>
    </AppLayout>
  );
}