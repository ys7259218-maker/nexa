"use client";

import { motion } from "framer-motion";

import {
  Phone,
  Calendar,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

export type AnalyticsStat = {
  title: string;
  value: string;
  note: string;
  icon: "phone" | "calendar" | "whatsapp" | "trend";
  color: string;
};

const icons = {
  phone: Phone,
  calendar: Calendar,
  whatsapp: MessageSquare,
  trend: TrendingUp,
};

export default function AnalyticsCards({ stats }: { stats: AnalyticsStat[] }) {
  return (
    <ul
      aria-label="Dashboard metrics"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6"
    >
      {stats.map((item, index) => {
        const Icon = icons[item.icon];

        return (
          <motion.li
            key={item.title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: index * 0.1,
            }}
            whileHover={{
              y: -8,
              scale: 1.03,
            }}
            className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 hover:border-cyan-500/40 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300"
          >
            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-sm text-zinc-400">
                  {item.title}
                </h2>

                <p className="text-4xl font-bold mt-3">
                  {item.value}
                </p>

                <p className="text-zinc-400 text-sm mt-3 font-medium">
                  {item.note}
                </p>

              </div>

              <div
                aria-hidden="true"
                className={`w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center ${item.color}`}
              >
                <Icon size={30} />
              </div>

            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
