import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listOutboundHistory,
  parseOutboundStatusFilter,
  previewBody,
  type OutboundRecord,
  type OutboundStatusFilter,
} from "@/lib/outboundHistory";
import { maskOpaqueId, outboundStatusLabel } from "@/lib/conversations";

export const metadata: Metadata = { title: "Outbound history | Nexa AI" };

type OutboundHistoryPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_FILTERS: OutboundStatusFilter[] = [
  "all",
  "sent",
  "delivered",
  "read",
  "failed",
  "draft_blocked",
];

const STATUS_CHIP: Record<string, string> = {
  sent: "bg-sky-500/10 text-sky-300",
  delivered: "bg-emerald-500/10 text-emerald-300",
  read: "bg-cyan-500/10 text-cyan-300",
  failed: "bg-rose-500/10 text-rose-300",
  draft_blocked: "bg-zinc-500/10 text-zinc-300",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function OutboundRow({ record }: { record: OutboundRecord }) {
  const status = record.status as string;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CHIP[status]}`}>
            {outboundStatusLabel(record.status)}
          </span>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
            {record.template_name ? `template · ${record.template_name}` : record.message_type}
          </span>
          {record.wa_message_id ? (
            <span className="text-[10px] text-zinc-600">{maskOpaqueId(record.wa_message_id)}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-200">{previewBody(record.body)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-zinc-500">Sent {formatDate(record.sent_at)}</p>
      </div>
    </div>
  );
}

export default async function OutboundHistoryPage({ searchParams }: OutboundHistoryPageProps) {
  await requireAuthenticatedUser();
  const { status } = await searchParams;
  const filter = parseOutboundStatusFilter(status);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <AppLayout>
        <p className="text-sm text-rose-300">Unable to connect to the message store.</p>
      </AppLayout>
    );
  }

  const result = await listOutboundHistory(supabase, filter);
  const records = result.error ? null : result.data;
  const loadError = result.error;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Activity</p>
          <h1 className="mt-2 text-4xl font-bold">Outbound history</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Every message this workspace sent, newest first, grouped by delivery status. Scoped to your account; sender ids are masked.
          </p>
        </div>

        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter outbound messages">
            {STATUS_FILTERS.map((item) => (
              <a
                key={item}
                href={item === "all" ? "/outbound-history" : `/outbound-history?status=${item}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filter === item
                    ? "bg-cyan-500 text-black"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {item === "all" ? "All" : outboundStatusLabel(item)}
              </a>
            ))}
          </div>

          {loadError ? (
            <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{loadError}</p>
          ) : null}

          {!loadError && records && records.length === 0 ? (
            <p className="py-6 text-sm text-zinc-500">No outbound messages match this filter.</p>
          ) : null}

          {records && records.length > 0 ? (
            <div>
              {records.map((record) => (
                <OutboundRow key={record.id} record={record} />
              ))}
            </div>
          ) : null}
        </Card>
      </div>
    </AppLayout>
  );
}