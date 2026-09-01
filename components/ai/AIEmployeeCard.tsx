import Link from "next/link";

import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Avatar from "../ui/Avatar";
import type { AIEmployee } from "@/lib/aiEmployees";

interface AIEmployeeCardProps {
  employee: AIEmployee;
}

export default function AIEmployeeCard({ employee }: AIEmployeeCardProps) {
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
      </div>

      <Link
        href={`/ai-employees/${employee.id}`}
        className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition-all duration-200 hover:bg-blue-500"
      >
        Manage AI Employee
      </Link>
    </Card>
  );
}
