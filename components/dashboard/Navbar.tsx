"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  return (
    <header className="flex min-h-18 flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-8">
      <p className="m-0 text-sm text-zinc-400">
        Nexa control center · protected workspace
      </p>

      <nav
        aria-label="Workspace shortcuts"
        className="flex flex-wrap items-center gap-4 sm:gap-5"
      >
        <Link aria-current={isActive("/dashboard") ? "page" : undefined} className="text-sm text-zinc-400 transition hover:text-white" href="/dashboard">
          Dashboard
        </Link>

        <Link aria-current={isActive("/search") ? "page" : undefined} className="text-sm text-zinc-400 transition hover:text-white" href="/search">
          Search
        </Link>

        <Link aria-current={isActive("/conversations") ? "page" : undefined} className="text-sm text-zinc-400 transition hover:text-white" href="/conversations">
          Inbox
        </Link>

        <Link aria-current={isActive("/ai-employees") ? "page" : undefined} className="text-sm text-zinc-400 transition hover:text-white" href="/ai-employees">
          AI Employees
        </Link>

        <Link aria-current={isActive("/settings/team") ? "page" : undefined} className="text-sm text-zinc-400 transition hover:text-white" href="/settings/team">
          Team
        </Link>
      </nav>
    </header>
  );
}
