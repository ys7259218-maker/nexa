"use client";

import { useRouter } from "next/navigation";

import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
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
  const router = useRouter();
  const lifecycleStatus = employee.lifecycle_status ?? "Draft";
  const isActive = lifecycleStatus === "Active" && employee.automation_paused === false;
  const readyPct = readinessTotal > 0 ? Math.round((readinessCount / readinessTotal) * 100) : 0;
  const readyColor = readyPct >= 100 ? "bg-emerald-400" : readyPct >= 50 ? "bg-amber-400" : "bg-red-400";

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
        <Badge
          variant={
            isActive
              ? "success"
              : "danger"
          }
        >
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
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
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

      <Button
        className="w-full"
        onClick={() => router.push(`/ai-employees/${employee.id}`)}
      >
        Manage AI Employee
      </Button>
    </Card>
  );
}
