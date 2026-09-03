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
import { countPriorInboundTurns, getConversationInbox, maskWhatsAppId } from "@/lib/conversations";
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
          </Card>
        ) : (
          <div className="grid min-h-[620px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-[320px_1fr]">
            <aside className="border-b border-white/10 bg-black/20 p-3 lg:border-b-0 lg:border-r">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Recent chats</p>
              <div className="space-y-1">
                {inbox.conversations.map((item) => {
                  const active = item.id === inbox.selectedConversation?.id;
                  return (
                    <Link
                      key={item.id}
                      href={`/conversations?conversation=${encodeURIComponent(item.id)}`}
                      className={`block rounded-2xl px-4 py-3 transition ${active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">WhatsApp contact</span>
                        <span className="text-xs text-zinc-500">{formatDate(item.last_message_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">{maskWhatsAppId(item.customer_wa_id)}</p>
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
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
                      <ShieldCheck size={14} /> Outbound disabled
                    </div>
                  </header>

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

                  <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    {inbox.messages.length === 0 ? (
                      <p className="py-16 text-center text-zinc-500">No stored messages in this conversation.</p>
                    ) : inbox.messages.map((message, index) => {
                      const isAiDraft = message.direction === "outbound" && message.status === "draft_blocked";
                      const recalledTurns = isAiDraft ? countPriorInboundTurns(inbox.messages, index) : 0;
                      return (
                        <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.direction === "outbound" ? "bg-white text-black" : "border border-white/10 bg-zinc-900 text-zinc-100"}`}>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body || `[${message.message_type} message]`}</p>
                            {isAiDraft ? (
                              <p className="mt-2 text-[11px] text-zinc-500">Drafted against {recalledTurns} prior customer {recalledTurns === 1 ? "turn" : "turns"}. Not sent — outbound is disabled.</p>
                            ) : (
                              <div className={`mt-2 flex gap-2 text-[11px] ${message.direction === "outbound" ? "text-zinc-600" : "text-zinc-500"}`}>
                                <span>{formatDate(message.created_at)}</span>
                                <span>·</span>
                                <span>{message.status}</span>
                              </div>
                            )}
                          </div>
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
