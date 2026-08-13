"use client";

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
  },
  {
    name: "AI Employees",
    icon: Bot,
  },
  {
    name: "Conversations",
    icon: MessageSquare,
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
            <button
              key={item.name}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-zinc-300 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all duration-200"
            >
              <Icon size={20} />

              <span>{item.name}</span>
            </button>
          );
        })}

      </nav>

    </aside>
  );
}