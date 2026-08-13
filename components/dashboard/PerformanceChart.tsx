"use client";

import Card from "@/components/ui/Card";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  Tooltip,
} from "recharts";

const data = [
  { day: "Mon", calls: 40 },
  { day: "Tue", calls: 62 },
  { day: "Wed", calls: 58 },
  { day: "Thu", calls: 90 },
  { day: "Fri", calls: 120 },
  { day: "Sat", calls: 105 },
  { day: "Sun", calls: 135 },
];

export default function PerformanceChart() {
  return (
    <Card className="space-y-6">

      <div>

        <h2 className="text-2xl font-bold">
          Performance Overview
        </h2>

        <p className="text-zinc-400">
          AI Calls during the last 7 days
        </p>

      </div>

      <div className="h-80">

        <ResponsiveContainer width="100%" height="100%">

          <AreaChart data={data}>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272A"
            />

            <XAxis
              dataKey="day"
              stroke="#71717A"
            />

            <Tooltip />

            <Area
              type="monotone"
              dataKey="calls"
              stroke="#06B6D4"
              fill="#06B6D4"
              fillOpacity={0.25}
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>

    </Card>
  );
}