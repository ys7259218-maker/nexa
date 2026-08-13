"use client";

import Card from "@/components/ui/Card";
import { Calendar, Clock, MapPin } from "lucide-react";

const appointments = [
  {
    customer: "John Smith",
    service: "AC Repair",
    date: "Today",
    time: "2:30 PM",
    location: "New York",
    status: "Confirmed",
  },
  {
    customer: "Sarah Johnson",
    service: "RO Installation",
    date: "Today",
    time: "4:00 PM",
    location: "Chicago",
    status: "Pending",
  },
  {
    customer: "Michael Brown",
    service: "Water Purifier Service",
    date: "Tomorrow",
    time: "10:00 AM",
    location: "Dallas",
    status: "Confirmed",
  },
];

export default function AppointmentsTable() {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Upcoming Appointments
        </h2>

        <p className="text-zinc-400">
          AI booked appointments
        </p>
      </div>

      <div className="space-y-4">

        {appointments.map((item, index) => (
          <div
            key={index}
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

            <div className="flex items-center gap-8 mt-5 text-zinc-400 text-sm">

              <div className="flex items-center gap-2">
                <Calendar size={16} />
                {item.date}
              </div>

              <div className="flex items-center gap-2">
                <Clock size={16} />
                {item.time}
              </div>

              <div className="flex items-center gap-2">
                <MapPin size={16} />
                {item.location}
              </div>

            </div>

          </div>
        ))}

      </div>

    </Card>
  );
}