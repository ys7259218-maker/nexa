"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import Card from "@/components/ui/Card";

import {
  Bot,
  Phone,
  Calendar,
  BarChart3,
  Inbox,
  Users,
} from "lucide-react";

const actions = [
  {
    title: "Review inbox",
    icon: Inbox,
    color: "text-amber-400",
    href: "/conversations",
  },
  {
    title: "Review AI Employees",
    icon: Users,
    color: "text-violet-400",
    href: "/ai-employees",
  },
  {
    title: "New AI Employee",
    icon: Bot,
    color: "text-cyan-400",
    href: "/dashboard/ai-employees/new",
  },
  {
    title: "View call records",
    icon: Phone,
    color: "text-pink-400",
    href: "/dashboard#calls",
  },
  {
    title: "Appointment records",
    icon: Calendar,
    color: "text-green-400",
    href: "/dashboard#appointments",
  },
  {
    title: "Recorded analytics",
    icon: BarChart3,
    color: "text-yellow-400",
    href: "/dashboard#analytics",
  },
];

export default function QuickActions({ pendingDrafts = 0 }: { pendingDrafts?: number }) {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Quick Actions
        </h2>

        <p className="text-zinc-400 mt-1">
          Frequently used actions for your business.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">

        {actions.map((action, index) => {
          const Icon = action.icon;

          return (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.35,
                delay: index * 0.08,
              }}
              whileHover={{
                y: -6,
                scale: 1.03,
              }}
              className="rounded-2xl"
            >
              <Link
                href={action.href}
                className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center ${action.color}`}
                >
                  <Icon size={28} aria-hidden />
                </div>

                <span className="text-center font-semibold text-white">
                  {action.title}
                </span>

                {action.title === "Review inbox" && pendingDrafts > 0 ? (
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    {pendingDrafts} pending
                  </span>
                ) : null}
              </Link>
            </motion.div>
          );
        })}

      </div>

    </Card>
  );
}
