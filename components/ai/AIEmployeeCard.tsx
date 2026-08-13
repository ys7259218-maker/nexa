"use client";

import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";

interface AIEmployeeCardProps {
  name: string;
  role: string;
  status: "Active" | "Offline";
  language: string;
}

export default function AIEmployeeCard({
  name,
  role,
  status,
  language,
}: AIEmployeeCardProps) {
  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={name} />

        <div>
          <h2 className="text-xl font-semibold">
            {name}
          </h2>

          <p className="text-zinc-400">
            {role}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Badge
          variant={
            status === "Active"
              ? "success"
              : "danger"
          }
        >
          {status}
        </Badge>

        <Badge variant="info">
          {language}
        </Badge>
      </div>

      <Button className="w-full">
        Manage AI Employee
      </Button>
    </Card>
  );
}