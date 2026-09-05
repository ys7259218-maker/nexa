import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/Dashboard";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardSnapshot } from "@/lib/dashboard";
import { getWorkspaceSafetyState } from "@/lib/workspaceSafety";

export const metadata: Metadata = { title: "Dashboard | Nexa AI" };

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <Dashboard
        userEmail={user.email}
        snapshot={null}
        error="Supabase is not configured. Add the variables from .env.example to load live data."
      />
    );
  }

  const result = await getDashboardSnapshot(supabase);
  const safetyEnabled = process.env.WORKSPACE_SAFETY_ENABLED === "true";
  const safetyResult = safetyEnabled ? await getWorkspaceSafetyState(supabase) : null;

  if (result.error || !result.snapshot) {
    return (
      <Dashboard
        userEmail={user.email}
        snapshot={null}
        error={result.error ?? "Unknown error while loading dashboard data."}
        workspaceSafety={safetyResult?.data ?? null}
      />
    );
  }

  return (
    <Dashboard
      userEmail={user.email}
      snapshot={result.snapshot}
      workspaceSafety={safetyResult?.data ?? null}
    />
  );
}
