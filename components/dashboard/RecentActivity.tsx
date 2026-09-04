"use client";

import Card from "@/components/ui/Card";
import type { ActivityEvent } from "@/lib/dashboard";

type RecentActivityProps = {
  activities: ActivityEvent[];
};

const CATEGORY_META: Record<
  ActivityEvent["category"],
  { label: string; className: string }
> = {
  general: { label: "General", className: "bg-zinc-800 text-zinc-300" },
  calls: { label: "Call", className: "bg-pink-500/20 text-pink-300" },
  appointments: { label: "Appointment", className: "bg-cyan-500/20 text-cyan-300" },
  whatsapp: { label: "WhatsApp", className: "bg-green-500/20 text-green-300" },
};

export default function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Recent Activity</h2>
        <p className="mt-1 text-zinc-400">Changes to your AI Employees will be logged here.</p>
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {activities.map((activity) => {
            const meta = CATEGORY_META[activity.category] ?? CATEGORY_META.general;
            return (
              <li key={activity.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    meta.className
                  }`}
                >
                  {meta.label}
                </span>
                <span className="text-sm text-zinc-100">{activity.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
