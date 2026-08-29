"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Phone,
  Calendar,
  BookOpen,
  BarChart3,
  Settings,
} from "lucide-react";

const menuItems = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    name: "AI Employees",
    icon: Bot,
    href: "/ai-employees",
  },
  {
    name: "Conversations",
    icon: MessageSquare,
    href: "/conversations",
  },
  {
    name: "Call records",
    icon: Phone,
    href: "/dashboard#calls",
  },
  {
    name: "Appointment records",
    icon: Calendar,
    href: "/dashboard#appointments",
  },
  {
    name: "Knowledge",
    icon: BookOpen,
    comingLater: "Saved references are available inside each AI Employee.",
  },
  {
    name: "Analytics",
    icon: BarChart3,
    href: "/dashboard#analytics",
  },
  {
    name: "Team settings",
    icon: Settings,
    href: "/settings/team",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside aria-label="Workspace sidebar" className="w-full border-b border-zinc-800 bg-zinc-950 p-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:p-6">

      <div className="mb-4 lg:mb-10">

        <h1 className="text-3xl font-bold text-cyan-400">
          Nexa
        </h1>

        <p className="text-zinc-500 text-sm mt-1">
          AI Business OS
        </p>

      </div>

      <nav aria-label="Primary workspace navigation" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:block lg:space-y-2">

        {menuItems.map((item) => {
          const Icon = item.icon;

          if (!item.href) {
            return (
              <div
                key={item.name}
                aria-disabled="true"
                title={item.comingLater}
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-zinc-600"
              >
                <Icon size={20} aria-hidden />
                <span>{item.name}</span>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Coming later
                </span>
              </div>
            );
          }

          // Hash shortcuts point into the Dashboard page; they are not separate pages.
          // `usePathname()` intentionally excludes fragments, so Dashboard remains the
          // single active page while these shortcuts never claim their own active state.
          const isFragmentShortcut = item.href.includes("#");
          const isActive =
            !isFragmentShortcut &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={20} aria-hidden />

              <span>{item.name}</span>
            </Link>
          );
        })}

      </nav>

    </aside>
  );
}
