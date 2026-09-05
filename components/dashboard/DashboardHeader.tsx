"use client";

import Link from "next/link";
import { Search, Bell, Settings, Plus, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DashboardHeaderProps = {
  userEmail: string;
  notificationCount?: number;
};

export default function DashboardHeader({ userEmail, notificationCount = 0 }: DashboardHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      router.push("/login");
      return;
    }

    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <div className="flex items-center justify-between">

      <div>

        <p className="text-zinc-500 text-sm">
          Workspace overview
        </p>

        <h1 className="text-4xl font-bold mt-2">
          Dashboard
        </h1>

        <p className="text-zinc-400 mt-2">
          Welcome back {userEmail}
        </p>

      </div>

      <div className="flex items-center gap-4">

        <form
          role="search"
          aria-label="Search Nexa workspace"
          action="/search"
          method="get"
          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2"
        >
          <Search size={18} className="shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            name="q"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Search employees, chats, calls, appointments"
            placeholder="Search…"
            className="bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </form>

        <Link
          href="/notifications"
          aria-label={
            notificationCount > 0
              ? `${notificationCount} notification${notificationCount === 1 ? "" : "s"} needing attention`
              : "Notifications, nothing needing attention"
          }
          title="Notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Bell size={18} aria-hidden="true" />
          {notificationCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            >
              {notificationCount}
            </span>
          ) : null}
        </Link>

        <Link
          href="/settings/team"
          aria-label="Open team settings"
          title="Team settings"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Settings size={18} aria-hidden />
        </Link>

        <Link
          href="/dashboard/ai-employees/new"
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-3 rounded-xl transition"
        >
          <Plus size={18} />
          New AI Employee
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-semibold px-5 py-3 rounded-xl transition"
        >
          <LogOut size={18} />
          Logout
        </button>

      </div>

    </div>
  );
}
