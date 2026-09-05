import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, ShieldCheck } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import ConversationSafetyControl from "@/components/conversations/ConversationSafetyControl";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
  getConversationWorkspaceRole,
  isConversationSafetyEnabled,
} from "@/lib/conversationSafety";
import { conversationSafetyIndicator, countPriorInboundTurns, explainMissingDraft, getConversationInbox, maskWhatsAppId, priorInboundTurnsBefore } from "@/lib/conversations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ConversationsPageProps = {
  searchParams: Promise<{ conversation?: string }>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const metadata: Metadata = { title: "Conversations | Nexa AI" };

export default async function ConversationsPage({ searchParams }: ConversationsPageProps) {
  const user = await requireAuthenticatedUser();
  const { conversation: requestedConversationId } = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <AppLayout>
        <Card className="space-y-3">
          <h1 className="text-2xl font-semibold text-red-400">Conversation inbox unavailable</h1>
          <p className="text-zinc-400">Supabase is not configured. Add the variables from .env.example and reload.</p>
        </Card>
      </AppLayout>
    );
  }

  const result = await getConversationInbox(supabase, requestedConversationId);

  if (result.error || !result.data) {
    return (
      <AppLayout>
        <div className="space-y-7">
          <div>
            <h1 className="text-4xl font-bold">Conversations</h1>
            <p className="mt-2 text-zinc-400">Review inbound WhatsApp messages and safely drafted AI replies.</p>
          </div>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-400">Could not load conversations</h2>
            <p className="text-zinc-400">{result.error ?? "The inbox could not be loaded."}</p>
            <Link className="text-cyan-400 hover:text-cyan-300" href="/conversations">Try again</Link>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const inbox = result.data;

  const conversationInboundCount = inbox.messages.filter(
    (message) => message.direction === "inbound",
  ).length;
  const selectedPendingDrafts = inbox.selectedConversation
    ? (inbox.pendingDraftCounts[inbox.selectedConversation.id] ?? 0)
    : 0;
  const missingDraftReasons = explainMissingDraft({
    conversation: inbox.selectedConversation,
    messages: inbox.messages,
    pendingDraftCounts: inbox.pendingDraftCounts,
  });

  const selectedSafety = inbox.selectedConversation
    ? conversationSafetyIndicator({
        customer_opted_out_at: inbox.selectedConversation.customer_opted_out_at,
        automation_mode: inbox.selectedConversation.automation_mode,
        human_takeover_at: inbox.selectedConversation.human_takeover_at,
        ai_employee_id: inbox.selectedConversation.ai_employee_id,
      })
    : null;

  const conversationSafetyEnabled = isConversationSafetyEnabled();
  const roleResult = conversationSafetyEnabled && inbox.selectedConversation
    ? await getConversationWorkspaceRole(
        supabase,
        inbox.selectedConversation.workspace_id,
        user.id,
      )
    : { data: null, error: null };

  return (
    <AppLayout>
      <div className="space-y-7">
        <div>
          <h1 className="text-4xl font-bold">Conversations</h1>
          <p className="mt-2 text-zinc-400">Review inbound WhatsApp messages and safely drafted AI replies.</p>
        </div>

        {inbox.conversations.length === 0 ? (
          <Card className="flex min-h-72 flex-col items-center justify-center text-center">
            <MessageCircle className="mb-4 text-zinc-600" size={42} />
            <h2 className="text-2xl font-semibold">No conversations yet</h2>
            <p className="mt-2 max-w-lg text-zinc-400">Inbound WhatsApp messages will appear here after Meta delivers them to your connected webhook.</p>
            <p className="mt-1 max-w-lg text-sm text-zinc-500">Make sure an AI Employee has a linked WhatsApp channel with a completed webhook setup, then send your first test message.</p>
            <Link
              href="/ai-employees"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-black transition hover:bg-cyan-400"
            >
              Open AI Employees to set up a channel
            </Link>
          </Card>
        ) : (
          <div className="grid min-h-[620px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-[320px_1fr]">
            <aside className="border-b border-white/10 bg-black/20 p-3 lg:border-b-0 lg:border-r">
              <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Recent chats</h2>
              <div className="space-y-1">
                {inbox.conversations.map((item) => {
                  const active = item.id === inbox.selectedConversation?.id;
                  const safety = conversationSafetyIndicator({
                    customer_opted_out_at: item.customer_opted_out_at,
                    automation_mode: item.automation_mode,
                    human_takeover_at: item.human_takeover_at,
                    ai_employee_id: item.ai_employee_id,
                  });
                  const safetyColor =
                    safety?.tone === "danger"
                      ? "text-red-400"
                      : safety?.tone === "warning"
                        ? "text-amber-400"
                        : safety?.tone === "muted"
                          ? "text-zinc-500"
                          : "";
                  return (
                    <Link
                      key={item.id}
                      href={`/conversations?conversation=${encodeURIComponent(item.id)}`}
                      className={`block rounded-2xl px-4 py-3 transition ${active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">WhatsApp contact</span>
                        <time dateTime={item.last_message_at} className="text-xs text-zinc-500">{formatDate(item.last_message_at)}</time>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">{maskWhatsAppId(item.customer_wa_id)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
                        {inbox.pendingDraftCounts[item.id] > 0 ? (
                          <span className="flex items-center gap-1.5 text-amber-400">
                            <span>{inbox.pendingDraftCounts[item.id]}</span>
                            <span>AI draft{inbox.pendingDraftCounts[item.id] === 1 ? "" : "s"} pending</span>
                          </span>
                        ) : null}
                        {safety ? (
                          <span className={safetyColor}>{safety.label}</span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-w-0 flex-col">
              {inbox.selectedConversation ? (
                <>
                  <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                    <div>
                      <h2 className="font-semibold">WhatsApp contact</h2>
                      <p className="text-sm text-zinc-500">{maskWhatsAppId(inbox.selectedConversation.customer_wa_id)}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {inbox.messages.length} message{inbox.messages.length === 1 ? "" : "s"} ·{" "}
                        {conversationInboundCount} customer {conversationInboundCount === 1 ? "turn" : "turns"}
                        {selectedPendingDrafts > 0
                          ? ` · ${selectedPendingDrafts} AI draft${selectedPendingDrafts === 1 ? "" : "s"} pending`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
                      <ShieldCheck size={14} /> Outbound disabled
                    </div>
                  </header>

                  {selectedSafety && selectedSafety.tone === "danger" ? (
                    <div className="border-b border-red-400/30 bg-red-500/10 px-6 py-3 text-sm text-red-300">
                      <span className="font-semibold">Safety flagged.</span>{" "}
                      {selectedSafety.label} — this conversation is not eligible for AI drafting.
                    </div>
                  ) : null}

                  {conversationSafetyEnabled ? (
                    roleResult.error ? (
                      <div className="border-b border-red-400/20 bg-red-400/5 px-6 py-4 text-sm text-red-300">
                        Conversation safety state could not be verified. AI drafting fails closed.
                      </div>
                    ) : (
                      <ConversationSafetyControl
                        workspaceId={inbox.selectedConversation.workspace_id}
                        conversationId={inbox.selectedConversation.id}
                        automationMode={inbox.selectedConversation.automation_mode}
                        customerOptedOutAt={inbox.selectedConversation.customer_opted_out_at}
                        role={roleResult.data}
                      />
                    )
                  ) : null}

                  {missingDraftReasons.length > 0 ? (
                    <div className="border-b border-white/10 bg-white/[0.02] px-6 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Why no draft?</p>
                      <ul className="mt-2 space-y-1.5">
                        {missingDraftReasons.map((reason) => (
                          <li key={reason.code} className="text-sm text-zinc-400">{reason.summary}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    {inbox.messages.length === 0 ? (
                      <p className="py-16 text-center text-zinc-500">No stored messages in this conversation.</p>
                    ) : inbox.messages.map((message, index) => {
                      const isAiDraft = message.direction === "outbound" && message.status === "draft_blocked";
                      const recalledTurns = isAiDraft ? countPriorInboundTurns(inbox.messages, index) : 0;
                      const draftTurns = isAiDraft ? priorInboundTurnsBefore(inbox.messages, index) : [];
                      return (
                        <div key={message.id} className={`flex flex-col ${message.direction === "outbound" ? "items-end" : "items-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.direction === "outbound" ? "bg-white text-black" : "border border-white/10 bg-zinc-900 text-zinc-100"}`}>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body || `[${message.message_type} message]`}</p>
                            {isAiDraft ? (
                              <p className="mt-2 text-[11px] text-zinc-500">Drafted against {recalledTurns} prior customer {recalledTurns === 1 ? "turn" : "turns"}. Not sent — outbound is disabled.</p>
                            ) : (
                              <div className={`mt-2 flex gap-2 text-[11px] ${message.direction === "outbound" ? "text-zinc-600" : "text-zinc-500"}`}>
                                <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
                                <span>·</span>
                                <span>{message.status}</span>
                              </div>
                            )}
                          </div>
                          {isAiDraft && draftTurns.length > 0 ? (
                            <details className="mt-1 max-w-[80%] text-[11px] text-zinc-500">
                              <summary className="cursor-pointer underline decoration-dotted">
                                Show the {draftTurns.length} source {draftTurns.length === 1 ? "turn" : "turns"} this draft was based on
                              </summary>
                              <ol className="mt-2 space-y-2">
                                {draftTurns.map((turn) => (
                                  <li key={turn.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                                    <p className="whitespace-pre-wrap break-words">{turn.body || `[${turn.message_type} message]`}</p>
                                    <p className="mt-1 text-zinc-500"><time dateTime={turn.created_at}>{formatDate(turn.created_at)}</time></p>
                                  </li>
                                ))}
                              </ol>
                            </details>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-zinc-500">Select a conversation to view its messages.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
