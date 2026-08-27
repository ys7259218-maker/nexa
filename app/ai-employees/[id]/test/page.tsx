import Link from "next/link";

import EmployeeTestSandbox from "@/components/ai/EmployeeTestSandbox";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { isValidSandboxEmployeeId } from "@/lib/employeeSandbox";
import { getAIEmployee, type AIEmployee } from "@/lib/aiEmployees";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AIEmployeeTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser();

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  let employee: AIEmployee | null = null;
  let loadState: "ready" | "unconfigured" | "failure" | "not-found" = "ready";

  if (!supabase) {
    loadState = "unconfigured";
  } else if (!isValidSandboxEmployeeId(id)) {
    loadState = "not-found";
  } else {
    const result = await getAIEmployee(supabase, id);

    if (result.error) loadState = "failure";
    else if (!result.data) loadState = "not-found";
    else employee = result.data;
  }

  const errorCopy = {
    unconfigured: "The safe simulation is unavailable because the app data connection is not configured.",
    failure: "This AI Employee could not be loaded. Try again from the management page.",
    "not-found": "This AI Employee was not found or does not belong to your account.",
  } as const;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Protected test sandbox
            </p>
            <h1 className="mt-2 text-4xl font-bold">
              {employee ? `Test ${employee.name}` : "Test AI Employee"}
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-400">
              Preview a deterministic draft without sending, saving, activating, or contacting an
              external AI service.
            </p>
          </div>

          <Link
            href={`/ai-employees/${id}`}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-800"
          >
            Back to management
          </Link>
        </div>

        {employee ? (
          <EmployeeTestSandbox employeeId={employee.id} />
        ) : (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-amber-300">Sandbox unavailable</h2>
            <p className="text-zinc-400">
              {loadState === "ready" ? errorCopy.failure : errorCopy[loadState]}
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
