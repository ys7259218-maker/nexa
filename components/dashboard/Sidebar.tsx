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
    name: "Calls",
    icon: Phone,
  },
  {
    name: "Appointments",
    icon: Calendar,
  },
  {
    name: "Knowledge",
    icon: BookOpen,
  },
  {
    name: "Analytics",
    icon: BarChart3,
  },
  {
    name: "Settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-zinc-950 border-r border-zinc-800 p-6">

      <div className="mb-10">

        <h1 className="text-3xl font-bold text-cyan-400">
          Nexa
        </h1>

        <p className="text-zinc-500 text-sm mt-1">
          AI Business OS
        </p>

      </div>

      <nav className="space-y-2">

        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href ?? "#"}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${
                item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={20} />

              <span>{item.name}</span>
            </Link>
          );
        })}

      </nav>

    </aside>
  );
}
