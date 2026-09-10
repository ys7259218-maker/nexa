import Link from "next/link";

import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Avatar from "../ui/Avatar";
import type { AIEmployee } from "@/lib/aiEmployees";

interface AIEmployeeCardProps {
  employee: AIEmployee;
  channelLinked: boolean;
  readinessCount: number;
  readinessTotal: number;
}

export default function AIEmployeeCard({
  employee,
  channelLinked,
  readinessCount,
  readinessTotal,
}: AIEmployeeCardProps) {
  const lifecycleStatus = employee.lifecycle_status ?? "Draft";
  const isActive = lifecycleStatus === "Active" && employee.automation_paused === false;
  const readyPct = readinessTotal > 0 ? Math.round((readinessCount / readinessTotal) * 100) : 0;
  const readyColor = readyPct >= 100 ? "bg-emerald-400" : readyPct >= 50 ? "bg-amber-400" : "bg-red-400";
  const lifecycleBadgeVariant =
    isActive
      ? "success"
      : lifecycleStatus === "Draft" || lifecycleStatus === "Paused"
        ? "warning"
        : "info";

  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={employee.name} />

        <div>
          <h2 className="text-xl font-semibold">
            {employee.name}
          </h2>

          <p className="text-zinc-400">
            {employee.business_name}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Badge variant={lifecycleBadgeVariant}>
          {isActive ? "Active" : lifecycleStatus}
        </Badge>

        <Badge variant="info">
          {employee.language}
        </Badge>

        <Badge
          variant={channelLinked ? "success" : "warning"}
        >
          {channelLinked ? "WhatsApp ready" : "No channel linked"}
        </Badge>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">Activation readiness</span>
          <span className="text-zinc-500">{readinessCount}/{readinessTotal} requirements</span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuenow={readyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Activation readiness ${readyPct}%`}
        >
          <div
            className={`h-full rounded-full transition-all ${readyColor}`}
            style={{ width: `${readyPct}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {channelLinked
          ? "A WhatsApp channel is assigned, so inbound conversations can be drafted for this employee."
          : "Assign or link a WhatsApp channel before this employee can handle inbound conversations."}
      </p>

      <Link
        href={`/ai-employees/${employee.id}`}
        className="block w-full text-center px-5 py-3 rounded-xl font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-500 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        Manage AI Employee
      </Link>
    </Card>
  );
}
