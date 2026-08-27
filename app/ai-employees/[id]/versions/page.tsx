import Link from "next/link";

import EmployeeVersionHistory from "@/components/ai/EmployeeVersionHistory";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getAIEmployee, type AIEmployee } from "@/lib/aiEmployees";
import {
  isValidEmployeeVersionId,
  listEmployeeVersions,
  type EmployeeVersion,
} from "@/lib/employeeVersions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EmployeeVersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser();

  const { id } = await params;
  const enabled = process.env.EMPLOYEE_VERSION_HISTORY_ENABLED === "true";
  const supabase = await createSupabaseServerClient();

  let employee: AIEmployee | null = null;
  let versions: EmployeeVersion[] = [];
  let error: string | null = null;

  if (!enabled) {
    error = "Version history is safely disabled until its database migration and RLS checks pass.";
  } else if (!supabase) {
    error = "Version history is unavailable because the app data connection is not configured.";
  } else if (!isValidEmployeeVersionId(id)) {
    error = "This AI Employee could not be found.";
  } else {
    const employeeResult = await getAIEmployee(supabase, id);
    if (employeeResult.error || !employeeResult.data) {
      error = "This AI Employee could not be found or does not belong to your workspace.";
    } else {
      employee = employeeResult.data;
      const versionResult = await listEmployeeVersions(supabase, id);
      if (versionResult.error) error = versionResult.error;
      else versions = versionResult.data;
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Immutable settings history
            </p>
            <h1 className="mt-2 text-4xl font-bold">
              {employee ? `${employee.name} versions` : "AI Employee versions"}
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-400">
              Review up to 50 automatically retained settings snapshots. Restoring never changes
              lifecycle status, channel links, or automation safety controls.
            </p>
          </div>

          <Link
            href={`/ai-employees/${id}`}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-800"
          >
            Back to management
          </Link>
        </div>

        {error ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-amber-300">Version history unavailable</h2>
            <p className="text-zinc-400">{error}</p>
          </Card>
        ) : employee ? (
          <EmployeeVersionHistory employeeId={employee.id} versions={versions} />
        ) : null}
      </div>
    </AppLayout>
  );
}
