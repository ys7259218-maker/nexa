import type { Metadata } from "next";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import DraftSendButton from "@/components/conversations/DraftSendButton";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOutboundSendReady, parseOutboundConfig } from "@/lib/outbound/whatsappSender";
import { maskWhatsAppId } from "@/lib/conversations";
import { previewBody } from "@/lib/outboundHistory";
import { listPendingApprovals, type PendingApproval } from "@/lib/pendingApprovals";

export const metadata: Metadata = { title: "Pending approvals | Nexa AI" };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function ApprovalRow({ approval }:{ approval: PendingApproval }) {
  const windowState = approval.windowOpen
    ? "bg-emerald-500/10 text-emerald-300"
    : "bg-rose-500/10 text-rose-300";
  return (
    <div className="border-b border-zinc-800 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/conversations?conversation=${approval.conversation_id}`}
              className="font-medium text-zinc-200 hover:text-cyan-300"
            >
              {approval.customer_wa_id ? maskWhatsAppId(approval.customer_wa_id) : "Unknown contact"}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${windowState}`}>
              {approval.windowOpen ? "Window open" : "Window closed"}
            </span>
            {approval.template_name ? (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">template</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-300">{previewBody(approval.body)}</p>
          <p className="mt-1 text-xs text-zinc-500">Drafted {formatDate(approval.created_at)}</p>
        </div>
      </div>
      {approval.windowOpen ? (
        <DraftSendButton messageId={approval.id} windowOpen={approval.windowOpen} />
      ) : (
        <p className="mt-2 text-[11px] text-zinc-500">
          Free-form sends are not allowed outside the service window.
        </p>
      )}
    </div>
  );
}

export default async function PendingApprovalsPage() {
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

  const result = await listPendingApprovals(supabase, outboundReady);
  const list = result.error ? null : result.data;
  const loadError = result.error;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Activity</p>
          <h1 className="mt-2 text-4xl font-bold">Pending approvals</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            AI drafts waiting on a human, newest first. Approve a draft here or inside its conversation.
          </p>
        </div>

        {!outboundReady ? (
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Outbound sending is disabled in this deployment — drafts can be drafted but not approved until outbound is configured.
          </p>
        ) : null}

        {loadError ? (
          <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{loadError}</p>
        ) : null}

        {list ? (
          <Card className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <p className="text-xs text-zinc-500">
                {list.total} draft{list.total === 1 ? "" : "s"} waiting for approval
                {list.truncated
                  ? ` · showing the newest ${list.approvals.length}`
                  : ""}
              </p>
            </div>
            {list.approvals.length === 0 ? (
              <p className="py-6 text-sm text-zinc-500">No drafts are waiting for approval.</p>
            ) : (
              list.approvals.map((approval) => (
                <ApprovalRow key={approval.id} approval={approval} />
              ))
            )}
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}