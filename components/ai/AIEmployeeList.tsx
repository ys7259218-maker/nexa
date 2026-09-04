import AIEmployeeCard from "./AIEmployeeCard";
import type { AIEmployee } from "@/lib/aiEmployees";

interface AIEmployeeListProps {
  employees: AIEmployee[];
  channelLinkedById?: Record<string, boolean>;
  readinessById?: Record<string, number>;
  readinessTotal?: number;
}

export default function AIEmployeeList({
  employees,
  channelLinkedById = {},
  readinessById = {},
  readinessTotal = 0,
}: AIEmployeeListProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {employees.map((employee) => (
        <AIEmployeeCard
          key={employee.id}
          employee={employee}
          channelLinked={channelLinkedById[employee.id] ?? false}
          readinessCount={readinessById[employee.id] ?? 0}
          readinessTotal={readinessTotal}
        />
      ))}
    </div>
  );
}
