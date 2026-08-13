import AppLayout from "@/components/layout/AppLayout";
import AIEmployeeForm from "@/components/ai/AIEmployeeForm";
import AIEmployeeList from "@/components/ai/AIEmployeeList";

export default function AIEmployeesPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold">
            AI Employees
          </h1>

          <p className="text-zinc-400 mt-2">
            Create, manage and monitor your AI workforce.
          </p>
        </div>

        <AIEmployeeForm />

        <AIEmployeeList />
      </div>
    </AppLayout>
  );
}