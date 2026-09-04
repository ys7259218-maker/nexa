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
}

export default function AIEmployeeCard({ employee, channelLinked }: AIEmployeeCardProps) {
  const router = useRouter();
  const lifecycleStatus = employee.lifecycle_status ?? "Draft";
  const isActive = lifecycleStatus === "Active" && employee.automation_paused === false;

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
