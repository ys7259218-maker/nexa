"use client";

import AIEmployeeCard from "./AIEmployeeCard";

const employees = [
  {
    name: "Nexa Receptionist",
    role: "Reception AI",
    status: "Active",
    language: "English",
  },
  {
    name: "Sales Assistant",
    role: "Sales AI",
    status: "Active",
    language: "Hindi",
  },
  {
    name: "Support Agent",
    role: "Support AI",
    status: "Offline",
    language: "English",
  },
];

export default function AIEmployeeList() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {employees.map((employee) => (
        <AIEmployeeCard
          key={employee.name}
          name={employee.name}
          role={employee.role}
          status={employee.status as "Active" | "Offline"}
          language={employee.language}
        />
      ))}
    </div>
  );
}