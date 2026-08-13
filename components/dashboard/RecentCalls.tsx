"use client";

import Card from "@/components/ui/Card";
import { Phone, Clock, ChevronRight } from "lucide-react";

const calls = [
  {
    customer: "John Smith",
    ai: "Nexa Receptionist",
    duration: "3m 24s",
    status: "Completed",
  },
  {
    customer: "Sarah Johnson",
    ai: "Nexa Receptionist",
    duration: "1m 52s",
    status: "Booked",
  },
  {
    customer: "Michael Brown",
    ai: "Nexa Receptionist",
    duration: "0m 41s",
    status: "Missed",
  },
];

export default function RecentCalls() {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Recent Calls
        </h2>

        <p className="text-zinc-400 mt-1">
          Latest AI conversations
        </p>
      </div>

      <div className="space-y-4">

        {calls.map((call, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-cyan-500/40 transition"
          >

            <div className="flex items-center gap-4">

              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Phone size={18} className="text-cyan-400" />
              </div>

              <div>
                <h3 className="font-semibold">
                  {call.customer}
                </h3>

                <p className="text-sm text-zinc-500">
                  {call.ai}
                </p>
              </div>

            </div>

            <div className="flex items-center gap-6">

              <div className="flex items-center gap-2 text-zinc-400">
                <Clock size={16} />
                {call.duration}
              </div>

              <span
                className={`text-sm font-medium ${
                  call.status === "Completed"
                    ? "text-green-400"
                    : call.status === "Booked"
                    ? "text-cyan-400"
                    : "text-red-400"
                }`}
              >
                {call.status}
              </span>

              <ChevronRight
                size={18}
                className="text-zinc-500"
              />

            </div>

          </div>
        ))}

      </div>

    </Card>
  );
}