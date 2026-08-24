import Dashboard from "@/components/dashboard/Dashboard";
import { requireAuthenticatedUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();

  return <Dashboard userEmail={user.email} />;
}
