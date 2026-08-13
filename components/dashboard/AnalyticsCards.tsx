"use client";

import { motion } from "framer-motion";

import {
  Phone,
  Calendar,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

const stats = [
  {
    title: "AI Calls Today",
    value: "128",
    change: "+18%",
    icon: Phone,
    color: "text-pink-400",
  },
  {
    title: "Appointments",
    value: "24",
    change: "+6%",
    icon: Calendar,
    color: "text-cyan-400",
  },
  {
    title: "WhatsApp Replies",
    value: "317",
    change: "+42%",
    icon: MessageSquare,
    color: "text-green-400",
  },
  {
    title: "Success Rate",
    value: "98%",
    change: "+2%",
    icon: TrendingUp,
    color: "text-yellow-400",
  },
];

export default function AnalyticsCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      {stats.map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.div
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

                <p className="text-sm text-zinc-400">
                  {item.title}
                </p>

                <h2 className="text-4xl font-bold mt-3">
                  {item.value}
                </h2>

                <p className="text-green-400 text-sm mt-3 font-medium">
                  {item.change} Today
                </p>

              </div>

              <div
                className={`w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center ${item.color}`}
              >
                <Icon size={30} />
              </div>

            </div>
          </motion.div>
        );
      })}
    </div>
  );
}