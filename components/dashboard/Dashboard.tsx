"use client";

import { motion } from "framer-motion";

import AppLayout from "../layout/AppLayout";

import DashboardHeader from "./DashboardHeader";
import AnalyticsCards from "./AnalyticsCards";
import QuickActions from "./QuickActions";
import PerformanceChart from "./PerformanceChart";
import RecentCalls from "./RecentCalls";
import AppointmentsTable from "./AppointmentsTable";

export default function Dashboard() {
  return (
    <AppLayout>
      <motion.div
        className="space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <DashboardHeader />

        <AnalyticsCards />

        <QuickActions />

        <div className="grid grid-cols-2 gap-6">
          <PerformanceChart />

          <RecentCalls />
        </div>

        <AppointmentsTable />
      </motion.div>
    </AppLayout>
  );
}