"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import AppLayout from "../layout/AppLayout";

import DashboardHeader from "./DashboardHeader";
import AnalyticsCards, { type AnalyticsStat } from "./AnalyticsCards";
import QuickActions from "./QuickActions";
import PerformanceChart from "./PerformanceChart";
import RecentCalls from "./RecentCalls";
import AppointmentsTable from "./AppointmentsTable";
import RecentActivity from "./RecentActivity";
import Card from "@/components/ui/Card";
import type { DashboardSnapshot } from "@/lib/dashboard";

type DashboardProps = {
  userEmail: string;
  snapshot: DashboardSnapshot | null;
  error?: string | null;
};

const emptyWeeklyCalls = [
  { day: "Mon", calls: 0 },
  { day: "Tue", calls: 0 },
  { day: "Wed", calls: 0 },
  { day: "Thu", calls: 0 },
  { day: "Fri", calls: 0 },
  { day: "Sat", calls: 0 },
  { day: "Sun", calls: 0 },
];

function buildStats(snapshot: DashboardSnapshot): AnalyticsStat[] {
  return [
    {
      title: "AI Calls Today",
      value: String(snapshot.callsToday),
      note: "Today",
      icon: "phone",
      color: "text-pink-400",
    },
    {
      title: "Appointments",
      value: String(snapshot.upcomingAppointments),
      note: "Upcoming",
      icon: "calendar",
      color: "text-cyan-400",
    },
    {
      title: "WhatsApp Replies",
      value: String(snapshot.whatsappReplies),
      note: "All time",
      icon: "whatsapp",
      color: "text-green-400",
    },
    {
      title: "Success Rate",
      value:
        snapshot.successRatePercent === null
          ? "—"
          : `${snapshot.successRatePercent}%`,
      note: "Last 7 days",
      icon: "trend",
      color: "text-yellow-400",
    },
  ];
}

export default function Dashboard({ userEmail, snapshot, error }: DashboardProps) {
  const router = useRouter();

  const view: DashboardSnapshot = snapshot ?? {
    callsToday: 0,
    upcomingAppointments: 0,
    whatsappReplies: 0,
    successRatePercent: null,
    weeklyCalls: emptyWeeklyCalls,
    recentCalls: [],
    appointments: [],
    activities: [],
  };

  return (
    <AppLayout>
      <motion.div
        className="space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <DashboardHeader userEmail={userEmail} />

        {error ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-400">
              Could not load your dashboard data
            </h2>

            <p className="text-zinc-400">
              {error}
            </p>

            <button
              onClick={() => router.refresh()}
              className="mt-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-3 rounded-xl transition w-fit"
            >
              Retry
            </button>
          </Card>
        ) : (
          <>
            <AnalyticsCards stats={buildStats(view)} />

            <QuickActions />

            <div className="grid grid-cols-2 gap-6">
              <PerformanceChart data={view.weeklyCalls} />

              <RecentCalls calls={view.recentCalls} />
            </div>

            <AppointmentsTable appointments={view.appointments} />

            <RecentActivity activities={view.activities} />
          </>
        )}
      </motion.div>
    </AppLayout>
  );
}
