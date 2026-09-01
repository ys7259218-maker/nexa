"use client";

import Link from "next/link";
import { Search, Bell, Settings, Plus, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SettingsFeedback, { type SettingsMessage } from "@/components/ai/SettingsFeedback";

type DashboardHeaderProps = {
  userEmail: string;
};

export default function DashboardHeader({ userEmail }: DashboardHeaderProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  async function handleLogout() {
    if (signingOut) return;

    setSigningOut(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage({
        type: "error",
        text: "Sign out is temporarily unavailable. Your session may still be active.",
      });
      setSigningOut(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setMessage({
          type: "error",
          text: "Sign out could not be completed. Your session may still be active. Try again.",
        });
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setMessage({
        type: "error",
        text: "Sign out could not be completed. Your session may still be active. Try again.",
      });
    } finally {
      setSigningOut(false);
    }
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

      <div className="flex items-center gap-4" aria-busy={signingOut}>

        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">

          <Search size={18} className="text-zinc-500" />

          <input
            aria-label="Global search (coming later)"
            placeholder="Search — coming later"
            title="Global search is not connected yet"
            disabled
            className="cursor-not-allowed bg-transparent text-sm text-zinc-500 outline-none placeholder:text-zinc-600"
          />

        </div>

        <button
          type="button"
          disabled
          aria-label="Notifications (coming later)"
          title="Notifications are not connected yet"
          className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-600"
        >
          <Bell size={18} aria-hidden />
        </button>

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
          disabled={signingOut}
          aria-busy={signingOut}
          aria-describedby={message ? "logout-feedback" : undefined}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-semibold px-5 py-3 rounded-xl transition"
        >
          <LogOut size={18} aria-hidden />
          {signingOut ? "Signing out…" : "Logout"}
        </button>

        {message ? <SettingsFeedback id="logout-feedback" message={message} /> : null}

      </div>

    </div>
  );
}
