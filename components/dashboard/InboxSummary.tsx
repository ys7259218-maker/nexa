"use client";

import Link from "next/link";

import Card from "@/components/ui/Card";

type InboxSummaryProps = {
  openConversations: number;
  pendingDrafts: number;
};

function pluralize(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

export default function InboxSummary({ openConversations, pendingDrafts }: InboxSummaryProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Inbox summary
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {pluralize(openConversations, "open conversation")} and{" "}
            {pluralize(pendingDrafts, "pending AI draft")} from recorded inbound messages.
          </p>
        </div>
        <Link
          href="/conversations"
          className="shrink-0 text-sm font-medium text-cyan-400 hover:text-cyan-300"
        >
          Open inbox
        </Link>
      </div>
    </Card>
  );
}
