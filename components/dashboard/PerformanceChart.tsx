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

        <h2 id="performance-overview-title" className="text-2xl font-bold">
          Performance Overview
        </h2>

        <p id="performance-overview-description" className="text-zinc-400">
          Stored call records from the last 7 days
        </p>

      </div>

      {data.every((point) => point.calls === 0) ? (
        <div
          role="status"
          aria-labelledby="performance-overview-title"
          aria-describedby="performance-overview-description"
          className="h-80 flex flex-col items-center justify-center gap-2 text-zinc-500"
        >
          <p className="font-medium text-zinc-400">
            No calls recorded yet
          </p>

          <p className="text-sm">
            Live calling is not connected yet. Verified call records will appear after a telephony integration is added.
          </p>
        </div>
      ) : (
        <figure
          aria-labelledby="performance-overview-title"
          aria-describedby="performance-overview-description"
          className="h-80"
        >

          <div aria-hidden="true" className="h-full">
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

          <figcaption className="sr-only">
            Calls by day:
            <ul>
              {data.map((point) => (
                <li key={point.day}>
                  {point.day}: {point.calls} {point.calls === 1 ? "call" : "calls"}
                </li>
              ))}
            </ul>
          </figcaption>
        </figure>
      )}

    </Card>
  );
}
