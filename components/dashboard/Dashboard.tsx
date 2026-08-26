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
import type { WorkspaceSafetyState } from "@/lib/workspaceSafety";
import WorkspaceKillSwitch from "./WorkspaceKillSwitch";

type DashboardProps = {
  userEmail: string;
  snapshot: DashboardSnapshot | null;
  error?: string | null;
  workspaceSafety?: WorkspaceSafetyState | null;
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
      title: "Calls recorded today",
      value: String(snapshot.callsToday),
      note: "Today",
      icon: "phone",
      color: "text-pink-400",
    },
    {
      title: "Upcoming records",
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
      title: "Recorded success rate",
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

export default function Dashboard({ userEmail, snapshot, error, workspaceSafety }: DashboardProps) {
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

        {workspaceSafety ? <WorkspaceKillSwitch state={workspaceSafety} /> : null}

        <Card className="border-amber-800/60 bg-amber-950/20">
          <p className="text-sm text-amber-200">
            Honest preview: WhatsApp inbound records can be reviewed now. Voice calling,
            appointment creation, outbound WhatsApp, and global search are not connected yet;
            their dashboard panels show stored records only.
          </p>
        </Card>

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
            <section id="analytics" className="scroll-mt-24" aria-label="Recorded analytics">
              <AnalyticsCards stats={buildStats(view)} />
            </section>

            <QuickActions />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PerformanceChart data={view.weeklyCalls} />

              <div id="calls" className="scroll-mt-24">
                <RecentCalls calls={view.recentCalls} />
              </div>
            </div>

            <div id="appointments" className="scroll-mt-24">
              <AppointmentsTable appointments={view.appointments} />
            </div>

            <RecentActivity activities={view.activities} />
          </>
        )}
      </motion.div>
    </AppLayout>
  );
}
