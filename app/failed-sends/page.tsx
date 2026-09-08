import type { Metadata } from "next";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import DraftSendButton from "@/components/conversations/DraftSendButton";
import RetryAllButton from "@/components/failed-sends/RetryAllButton";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOutboundSendReady, parseOutboundConfig } from "@/lib/outbound/whatsappSender";
import { maskWhatsAppId } from "@/lib/conversations";
import { previewBody } from "@/lib/outboundHistory";
import { listFailedSends, type FailedSend } from "@/lib/failedSends";

export const metadata: Metadata = { title: "Failed sends | Nexa AI" };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function FailedRow({ send }: { send: FailedSend }) {
  const windowState = send.windowOpen
    ? "bg-emerald-500/10 text-emerald-300"
    : "bg-zinc-500/10 text-zinc-300";
  return (
    <div className="border-b border-zinc-800 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/conversations?conversation=${send.conversation_id}`}
              className="font-medium text-zinc-200 hover:text-cyan-300"
            >
              {send.customer_wa_id ? maskWhatsAppId(send.customer_wa_id) : "Unknown contact"}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${windowState}`}>
              {send.windowOpen ? "Window open" : "Window closed"}
            </span>
            {send.optedOut ? (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                Opted out
              </span>
            ) : null}
            {send.template_name ? (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">template</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-300">{previewBody(send.body)}</p>
          <p className="mt-1 text-xs text-zinc-500">Drafted {formatDate(send.created_at)}</p>
        </div>
      </div>
      {send.retryable ? (
        <div className="mt-2">
          <DraftSendButton messageId={send.id} windowOpen={send.windowOpen} retry />
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-zinc-500">
          {send.optedOut
            ? "This customer has opted out, so this send can&apos;t be retried."
            : send.template_name
              ? "Template-based sends can&apos;t be auto-retried — approve a fresh template send instead."
              : "This send is outside the 24-hour window or outbound is disabled, so it can&apos;t be retried automatically."}
        </p>
      )}
      {send.failure_reason ? (
        <p className="mt-2 text-[11px] text-amber-300/80">
          Why Meta did not accept it: {send.failure_reason}
        </p>
      ) : null}
    </div>
  );
}

export default async function FailedSendsPage() {
  await requireAuthenticatedUser();
  const outboundReady = isOutboundSendReady(parseOutboundConfig());
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <AppLayout>
        <p className="text-sm text-rose-300">Unable to connect to the message store.</p>
      </AppLayout>
    );
  }

  const result = await listFailedSends(supabase, outboundReady);
  const queues = result.error ? null : result.data;
  const loadError = result.error;
  const retryableCount = queues ? queues.sends.filter((send) => send.retryable).length : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Activity</p>
          <h1 className="mt-2 text-4xl font-bold">Failed sends</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Outbound messages Meta did not accept, newest first. Free-form failures inside the 24-hour window can be retried here; template failures need a fresh template approval.
          </p>
        </div>

        {!outboundReady ? (
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Outbound sending is disabled in this deployment — failed sends can&apos;t be retried until outbound is configured.
          </p>
        ) : null}

        {loadError ? (
          <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{loadError}</p>
        ) : null}

        {queues ? (
          <Card className="space-y-1">
            {queues.sends.length === 0 ? (
              <p className="py-6 text-sm text-zinc-500">No failed outbound messages right now.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                  <p className="text-xs text-zinc-500">
                    {queues.sends.length} failed {queues.sends.length === 1 ? "send" : "sends"} · {retryableCount} retryable
                    {queues.truncated
                      ? ` of ${queues.total} total, showing the newest ${queues.sends.length}`
                      : ` · ${queues.total} total`}
                  </p>
                  <RetryAllButton retryableCount={retryableCount} />
                </div>
                {queues.sends.map((send) => (
                  <FailedRow key={send.id} send={send} />
                ))}
              </>
            )}
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}