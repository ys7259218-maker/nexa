"use client";

import Card from "@/components/ui/Card";
import { Phone, Clock, ChevronRight } from "lucide-react";
import { formatCallDuration, type CallRecord } from "@/lib/dashboard";

type RecentCallsProps = {
  calls: CallRecord[];
};

export default function RecentCalls({ calls }: RecentCallsProps) {
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

      {calls.length === 0 ? (
        <p className="text-zinc-500 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          No calls yet. Conversations handled by your AI Employees will show up here.
        </p>
      ) : (
        <div className="space-y-4">

          {calls.map((call) => (
            <div
              key={call.id}
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
                    AI Employee
                  </p>
                </div>

              </div>

              <div className="flex items-center gap-6">

                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock size={16} />
                  {formatCallDuration(call.duration_seconds)}
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
      )}

    </Card>
  );
}
