"use client";

import Card from "@/components/ui/Card";
import { Calendar, Clock, MapPin } from "lucide-react";
import type { AppointmentRecord } from "@/lib/dashboard";

type AppointmentsTableProps = {
  appointments: AppointmentRecord[];
};

export default function AppointmentsTable({ appointments }: AppointmentsTableProps) {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Upcoming Appointments
        </h2>

        <p className="text-zinc-400">
          Stored appointment records; booking automation is not connected
        </p>
      </div>

      {appointments.length === 0 ? (
        <p className="text-zinc-500 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          No appointment records. Nexa cannot create bookings yet; verified records will appear here after a booking integration is added.
        </p>
      ) : (
        <div className="space-y-4">

          {appointments.map((item) => {
            const scheduled = new Date(item.scheduled_at);

            return (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-cyan-500/40 transition"
              >

                <div className="flex items-center justify-between">

                  <div>

                    <h3 className="font-semibold text-lg">
                      {item.customer}
                    </h3>

                    <p className="text-zinc-500">
                      {item.service}
                    </p>

                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      item.status === "Confirmed"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {item.status}
                  </span>

                </div>

                <div className="flex items-center gap-8 mt-5 text-zinc-400 text-sm flex-wrap">

                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <time dateTime={item.scheduled_at}>{scheduled.toLocaleDateString()}</time>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    {scheduled.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    {item.location || "—"}
                  </div>

                </div>

              </div>
            );
          })}

        </div>
      )}

    </Card>
  );
}
