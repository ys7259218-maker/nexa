import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deliveryStageLabel,
  getDeliveryFunnel,
  type DeliveryStage,
} from "@/lib/deliveryFunnel";

export const metadata: Metadata = { title: "Delivery funnel | Nexa AI" };

const STAGE_ORDER: DeliveryStage[] = ["sent", "delivered", "read", "failed"];

const STAGE_BAR: Record<DeliveryStage, string> = {
  sent: "bg-sky-500",
  delivered: "bg-emerald-500",
  read: "bg-cyan-500",
  failed: "bg-rose-500",
};

function CardStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-zinc-100">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-400">{sub}</p> : null}
    </div>
  );
}

export default async function DeliveryFunnelPage() {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <AppLayout>
        <p className="text-sm text-rose-300">Unable to connect to the message store.</p>
      </AppLayout>
    );
  }

  const result = await getDeliveryFunnel(supabase);
  const funnel = result.error ? null : result.data;
  const loadError = result.error;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Activity</p>
          <h1 className="mt-2 text-4xl font-bold">Delivery funnel</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            How outbound messages travel from sent to read. Rates are exact over all of this account&apos;s outbound messages.
          </p>
        </div>

        {loadError ? (
          <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{loadError}</p>
        ) : null}

        {funnel ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardStat
                label="Attempted"
                value={funnel.attempted.toLocaleString()}
                sub="sent + delivered + read + failed"
              />
              <CardStat
                label="Delivered rate"
                value={`${funnel.deliveredRatePercent}%`}
                sub="delivered or read relative to attempted"
              />
              <CardStat
                label="Read rate"
                value={`${funnel.readRatePercent}%`}
                sub="read relative to attempted"
              />
              <CardStat
                label="Failed rate"
                value={`${funnel.failedRatePercent}%`}
                sub="failed relative to attempted"
              />
            </div>

            <Card className="space-y-4">
              <h2 className="text-xl font-semibold">Funnel</h2>
              {funnel.attempted === 0 ? (
                <p className="py-4 text-sm text-zinc-500">No outbound messages yet. Send one to populate the funnel.</p>
              ) : (
                <div className="space-y-4">
                  {STAGE_ORDER.map((stage) => {
                    const count = funnel.stageCounts[stage];
                    const percent = funnel.attempted === 0 ? 0 : Math.round((count / funnel.attempted) * 100);
                    return (
                      <div key={stage}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-300">{deliveryStageLabel(stage)}</span>
                          <span className="text-zinc-400">
                            {count.toLocaleString()} · {percent}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div className={`h-full ${STAGE_BAR[stage]}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-zinc-600">
                Terminal outbound statuses only. Messages still awaiting a send (draft) are not counted here.
              </p>
            </Card>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}