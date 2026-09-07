"use client";

import { motion, MotionConfig } from "framer-motion";
import { useRouter } from "next/navigation";

import AppLayout from "../layout/AppLayout";

import DashboardHeader from "./DashboardHeader";
import AnalyticsCards, { type AnalyticsStat } from "./AnalyticsCards";
import InboxSummary from "./InboxSummary";
import QuickActions from "./QuickActions";
import PerformanceChart from "./PerformanceChart";
import RecentCalls from "./RecentCalls";
import AppointmentsTable from "./AppointmentsTable";
import RecentActivity from "./RecentActivity";
import Card from "@/components/ui/Card";
import Link from "next/link";
import type { DashboardSnapshot } from "@/lib/dashboard";
import type { WorkspaceSafetyState } from "@/lib/workspaceSafety";
import type { NotificationItem } from "@/lib/notifications";
import WorkspaceKillSwitch from "./WorkspaceKillSwitch";

type DashboardProps = {
  userEmail: string;
  snapshot: DashboardSnapshot | null;
  error?: string | null;
  workspaceSafety?: WorkspaceSafetyState | null;
  notificationCount?: number;
  notificationItems?: NotificationItem[] | null;
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
      title: "WhatsApp activity records",
      value: String(snapshot.whatsappActivityRecords),
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
      note:
        snapshot.successRatePercent === null
          ? "No recorded calls in the last 7 days"
          : "Last 7 days",
      icon: "trend",
      color: "text-yellow-400",
    },
    {
      title: "Outbound delivered",
      value:
        snapshot.deliveredRatePercent === null
          ? "—"
          : `${snapshot.deliveredRatePercent}%`,
      note:
        snapshot.deliveredRatePercent === null
          ? "No outgoing messages yet"
          : `${snapshot.readRatePercent}% read`,
      icon: "whatsapp",
      color: "text-green-400",
      href: "/delivery-funnel",
    },
    ...(snapshot.failedSendsCount > 0
      ? ([
          {
            title: "Failed sends",
            value: String(snapshot.failedSendsCount),
            note: "Review & retry",
            icon: "whatsapp",
            color: "text-rose-400",
            href: "/failed-sends",
          },
        ] as AnalyticsStat[])
      : []),
  ];
}

const TONE_CLASS: Record<NotificationItem["tone"], string> = {
  danger: "bg-rose-400",
  warning: "bg-amber-400",
  info: "bg-cyan-400",
};

function AttentionPanel({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="border-rose-800/50 bg-rose-950/10">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-lg font-semibold">Attention needed</h2>
        <Link href="/notifications" className="text-xs text-cyan-400 hover:text-cyan-300">
          View all notifications →
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
              <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${TONE_CLASS[item.tone]}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-100">{item.title}</span>
                <span className="block text-xs text-zinc-400">{item.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Dashboard({ userEmail, snapshot, error, workspaceSafety, notificationCount = 0, notificationItems = [] }: DashboardProps) {
  const router = useRouter();

  const view: DashboardSnapshot = snapshot ?? {
    callsToday: 0,
    upcomingAppointments: 0,
    whatsappActivityRecords: 0,
    openConversations: 0,
    pendingDrafts: 0,
    successRatePercent: null,
    deliveredRatePercent: null,
    readRatePercent: null,
    failedSendsCount: 0,
    weeklyCalls: emptyWeeklyCalls,
    recentCalls: [],
    appointments: [],
    activities: [],
  };

  return (
    <AppLayout>
      <MotionConfig reducedMotion="user">
        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
        <DashboardHeader userEmail={userEmail} notificationCount={notificationCount} />

        {workspaceSafety ? <WorkspaceKillSwitch state={workspaceSafety} /> : null}

        {notificationItems ? <AttentionPanel items={notificationItems} /> : null}

        <Card className="border-amber-800/60 bg-amber-950/20">
          <p className="text-sm text-amber-200">
            Honest preview: WhatsApp inbound records can be reviewed in Inbox after the inbound
            readiness checks pass. Voice calling, appointment creation, outbound WhatsApp, and
            global search are not connected yet; their dashboard panels show stored records only.
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
              type="button"
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

            <InboxSummary
              openConversations={view.openConversations}
              pendingDrafts={view.pendingDrafts}
            />

            <QuickActions pendingDrafts={view.pendingDrafts} />

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
      </MotionConfig>
    </AppLayout>
  );
}
