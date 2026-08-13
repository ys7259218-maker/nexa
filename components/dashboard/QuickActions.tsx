"use client";

import { motion } from "framer-motion";

import Card from "@/components/ui/Card";

import {
  Bot,
  Phone,
  Calendar,
  BarChart3,
} from "lucide-react";

const actions = [
  {
    title: "New AI Employee",
    icon: Bot,
    color: "text-cyan-400",
  },
  {
    title: "View Calls",
    icon: Phone,
    color: "text-pink-400",
  },
  {
    title: "Appointments",
    icon: Calendar,
    color: "text-green-400",
  },
  {
    title: "Analytics",
    icon: BarChart3,
    color: "text-yellow-400",
  },
];

export default function QuickActions() {
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
            <motion.button
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
              whileTap={{
                scale: 0.97,
              }}
              className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 flex flex-col items-center justify-center gap-4 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300"
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center ${action.color}`}
              >
                <Icon size={28} />
              </div>

              <span className="font-semibold text-white">
                {action.title}
              </span>
            </motion.button>
          );
        })}

      </div>

    </Card>
  );
}