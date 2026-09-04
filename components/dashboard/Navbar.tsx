"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="flex min-h-18 flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-8">
      <p className="m-0 text-sm text-zinc-400">
        Nexa control center · protected workspace
      </p>

      <nav
        aria-label="Workspace shortcuts"
        className="flex flex-wrap items-center gap-4 sm:gap-5"
      >
        <Link className="text-sm text-zinc-400 transition hover:text-white" href="/dashboard">
          Dashboard
        </Link>

        <Link className="text-sm text-zinc-400 transition hover:text-white" href="/conversations">
          Inbox
        </Link>

        <Link className="text-sm text-zinc-400 transition hover:text-white" href="/ai-employees">
          AI Employees
        </Link>

        <Link className="text-sm text-zinc-400 transition hover:text-white" href="/settings/team">
          Team
        </Link>
      </nav>
    </header>
  );
}
