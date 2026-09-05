import type { Metadata } from "next";
import Link from "next/link";

import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getNotifications, type NotificationItem } from "@/lib/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications | Nexa AI" };

const toneClass: Record<NotificationItem["tone"], string> = {
  danger: "border-red-400/30 bg-red-500/10",
  warning: "border-amber-400/30 bg-amber-400/10",
  info: "border-zinc-700 bg-zinc-900",
};

const toneDot: Record<NotificationItem["tone"], string> = {
  danger: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-cyan-400",
};

export default async function NotificationsPage() {
  await requireAuthenticatedUser();

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <AppLayout>
        <Card className="space-y-3">
          <h1 className="text-2xl font-semibold text-red-400">Notifications unavailable</h1>
          <p className="text-zinc-400">
            Supabase is not configured. Add the variables from .env.example and reload.
          </p>
        </Card>
      </AppLayout>
    );
  }

  const result = await getNotifications(supabase);

  if (result.error) {
    return (
      <AppLayout>
        <Card className="space-y-3">
          <h1 className="text-2xl font-semibold text-red-400">Could not load notifications</h1>
          <p className="text-zinc-400">{result.error}</p>
        </Card>
      </AppLayout>
    );
  }

  const items = result.data ?? [];

  return (
    <AppLayout>
      <div className="space-y-7">
        <div>
          <h1 className="text-4xl font-bold">Notifications</h1>
          <p className="mt-2 text-zinc-400">
            What needs your attention in the workspace, derived from your stored records.
          </p>
        </div>

        {items.length === 0 ? (
          <Card className="space-y-2">
            <h2 className="text-xl font-semibold">You are all caught up</h2>
            <p className="text-zinc-400">
              Nothing needs your attention right now. Draft reviews, open conversations, and
              channel setup reminders will appear here.
            </p>
          </Card>
        ) : (
          <ul className="space-y-4" aria-label="Notifications list">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`block rounded-2xl border p-5 transition hover:opacity-90 ${toneClass[item.tone]}`}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneDot[item.tone]}`} />
                    <div>
                      <span className="font-semibold text-white">{item.title}</span>
                      <span className="mt-0.5 block text-sm text-zinc-400">{item.detail}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}