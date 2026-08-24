"use client";

import Link from "next/link";
import { Search, Bell, Settings, Plus, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DashboardHeaderProps = {
  userEmail: string;
};

export default function DashboardHeader({ userEmail }: DashboardHeaderProps) {
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
          Good Morning 👋
        </p>

        <h1 className="text-4xl font-bold mt-2">
          Dashboard
        </h1>

        <p className="text-zinc-400 mt-2">
          Welcome back {userEmail}
        </p>

      </div>

      <div className="flex items-center gap-4">

        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">

          <Search size={18} className="text-zinc-500" />

          <input
            placeholder="Search..."
            className="bg-transparent outline-none text-sm text-white placeholder:text-zinc-500"
          />

        </div>

        <button className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition">
          <Bell size={18} />
        </button>

        <button className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition">
          <Settings size={18} />
        </button>

        <Link
          href="/dashboard/ai-employees/new"
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-3 rounded-xl transition"
        >
          <Plus size={18} />
          New AI Employee
        </Link>

        <button
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
