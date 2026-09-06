import type { Metadata } from "next";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getNotifications, type NotificationItem } from "@/lib/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications | Nexa AI" };

const TONE_CLASS: Record<NotificationItem["tone"], string> = {
  danger: "bg-rose-400",
  warning: "bg-amber-400",
  info: "bg-cyan-400",
};

function NotificationRow({ item }: { item: NotificationItem }) {
  return (
    <Link href={item.href} className="block border-b border-zinc-800 py-3 last:border-0 hover:bg-zinc-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${TONE_CLASS[item.tone]}`}
              aria-hidden="true"
            />
            <p className="font-medium text-zinc-200">{item.title}</p>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{item.detail}</p>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">View →</span>
      </div>
    </Link>
  );
}

export default async function NotificationsPage() {
  await requireAuthenticatedUser();
  const client = await createSupabaseServerClient();
  if (!client) {
    return (
      <AppLayout>
        <Card>
          <h1 className="text-2xl font-bold">Notifications unavailable</h1>
          <p className="mt-2 text-red-300">The workspace data connection is not configured.</p>
        </Card>
      </AppLayout>
    );
  }

  const result = await getNotifications(client);
  const items = result.error ? null : result.data;
  const loadError = result.error;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Inbox</p>
          <h1 className="text-4xl font-bold">Notifications</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Actionable items derived from your current workspace state, in priority order.
          </p>
        </div>
        {items === null ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-300">Notifications could not be loaded</h2>
            <p className="text-zinc-400">{loadError}</p>
          </Card>
        ) : items.length === 0 ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold">You&apos;re all caught up</h2>
            <p className="text-zinc-400">
              No pending drafts, unlinked channels, or unhandled conversations right now.
            </p>
          </Card>
        ) : (
          <Card className="space-y-1">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-xl font-semibold">To do</h2>
              <span className="text-xs text-zinc-500">{items.length} item{items.length === 1 ? "" : "s"}</span>
            </div>
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
            <p className="pt-3 text-xs text-zinc-600">Computed from live workspace state; nothing here is stored separately.</p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}