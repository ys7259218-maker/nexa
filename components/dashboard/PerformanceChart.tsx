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

type PerformanceChartProps = {
  data: Array<{ day: string; calls: number }>;
};

export default function PerformanceChart({ data }: PerformanceChartProps) {
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

      {data.every((point) => point.calls === 0) ? (
        <div className="h-80 flex flex-col items-center justify-center gap-2 text-zinc-500">
          <p className="font-medium text-zinc-400">
            No calls recorded yet
          </p>

          <p className="text-sm">
            Call activity will appear here once your AI Employees start handling conversations.
          </p>
        </div>
      ) : (
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
      )}

    </Card>
  );
}
