import AIEmployeeCard from "./AIEmployeeCard";
import type { AIEmployee } from "@/lib/aiEmployees";

interface AIEmployeeListProps {
  employees: AIEmployee[];
}

export default function AIEmployeeList({ employees }: AIEmployeeListProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {employees.map((employee) => (
        <AIEmployeeCard
          key={employee.id}
          employee={employee}
        />
      ))}
    </div>
  );
}
