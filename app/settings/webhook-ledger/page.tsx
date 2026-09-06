import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { maskWhatsAppId } from "@/lib/conversations";
import { parseWebhookStatusFilter, webhookStatusLabel, type LedgerEvent, type WebhookEventStatusFilter } from "@/lib/webhookLedger";

export const metadata: Metadata = { title: "Webhook ledger | Nexa AI" };

type LedgerPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_FILTERS: WebhookEventStatusFilter[] = ["all", "claimed", "processed", "skipped", "failed"];

const STATUS_CHIP: Record<string, string> = {
  claimed: "bg-amber-500/10 text-amber-300",
  processed: "bg-emerald-500/10 text-emerald-300",
  skipped: "bg-zinc-500/10 text-zinc-300",
  failed: "bg-rose-500/10 text-rose-300",
};

async function fetchLedger(filter: string): Promise<LedgerEvent[] | string> {
  const query = filter === "all" ? "" : `?status=${filter}`;
  const response = await fetch(`/api/ops/webhook-events${query}`, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return body.error ?? "Unable to load the webhook ledger.";
  }
  const body = (await response.json()) as { data: LedgerEvent[] };
  return body.data;
}

function LedgerRow({ event }: { event: LedgerEvent }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CHIP[event.status]}`}>
            {webhookStatusLabel(event.status)}
          </span>
          <p className="font-medium text-zinc-200">{event.event_kind}</p>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">{event.message_type}</span>
        </div>
        <p className="mt-1 truncate text-sm text-zinc-400">
          {event.event_id}
        </p>
        {event.last_error ? (
          <p className="mt-1 text-xs text-rose-300">Last error: {event.last_error}</p>
        ) : null}
        {event.from_wa_id ? (
          <p className="mt-1 text-xs text-zinc-500">
            From {event.profile_name || "unknown"} ({maskWhatsAppId(event.from_wa_id)}) &middot; attempts {event.attempts}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-zinc-300">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.received_at))}</p>
      </div>
    </div>
  );
}

export default async function WebhookLedgerPage({ searchParams }: LedgerPageProps) {
  await requireAuthenticatedUser();
  const { status } = await searchParams;
  const filter = parseWebhookStatusFilter(status);

  const result = await fetchLedger(filter);
  const events = typeof result === "string" ? null : result;
  const error = typeof result === "string" ? result : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Settings</p>
          <h1 className="mt-2 text-4xl font-bold">Webhook ledger</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Durable inbound events for this deployment, newest first. Ledger rows are read through the server-only connection.
          </p>
        </div>

        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter webhook events">
            {STATUS_FILTERS.map((item) => (
              <a
                key={item}
                href={item === "all" ? "/settings/webhook-ledger" : `/settings/webhook-ledger?status=${item}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filter === item
                    ? "bg-cyan-500 text-black"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {item === "all" ? "All" : webhookStatusLabel(item)}
              </a>
            ))}
          </div>

          {error ? (
            <p className="rounde-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>
          ) : null}

          {!error && events && events.length === 0 ? (
            <p className="py-6 text-sm text-zinc-500">No webhook events match this filter.</p>
          ) : null}

          {events ? (
            <div>
              {events.map((event) => (
                <LedgerRow key={event.id} event={event} />
              ))}
            </div>
          ) : null}

          {!error ? (
            <p className="mt-2 text-xs text-zinc-600">
              Read-only ledger view. Raw message bodies are stored by the processor for replay and are masked here.
            </p>
          ) : null}
        </Card>
      </div>
    </AppLayout>
  );
}