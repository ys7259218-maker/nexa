"use client";

import Card from "@/components/ui/Card";
import { Phone, Clock } from "lucide-react";
import { formatCallDuration, type CallRecord } from "@/lib/dashboard";

type RecentCallsProps = {
  calls: CallRecord[];
};

export default function RecentCalls({ calls }: RecentCallsProps) {
  return (
    <section aria-labelledby="recent-calls-heading">
    <Card className="space-y-6">

      <div>
        <h2 id="recent-calls-heading" className="text-2xl font-bold">
          Recent Calls
        </h2>

        <p className="text-zinc-400 mt-1">
          Stored call records; live telephony is not connected
        </p>
      </div>

      {calls.length === 0 ? (
        <p role="status" className="text-zinc-500 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          No call records. Live calling is not connected yet; verified records will appear here after a telephony integration is added.
        </p>
      ) : (
        <ul aria-labelledby="recent-calls-heading" className="space-y-4 list-none p-0">

          {calls.map((call) => (
            <li
              key={call.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-cyan-500/40 transition"
            >

              <div className="flex items-center gap-4">

                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <Phone size={18} className="text-cyan-400" aria-hidden="true" />
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
                  <Clock size={16} aria-hidden="true" />
                  {formatCallDuration(call.duration_seconds)}
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    call.status === "Completed"
                      ? "bg-green-500/20 text-green-400"
                      : call.status === "Booked"
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {call.status}
                </span>

              </div>

            </li>
          ))}

        </ul>
      )}

    </Card>
    </section>
  );
}
