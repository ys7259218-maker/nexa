import AppLayout from "@/components/layout/AppLayout";

export default function EmployeeVersionsLoading() {
  return (
    <AppLayout>
      <div className="space-y-8" aria-busy="true" aria-label="Loading AI Employee version history">
        <div className="space-y-3">
          <div className="h-4 w-48 animate-pulse rounded bg-zinc-800" />
          <div className="h-10 w-80 max-w-full animate-pulse rounded bg-zinc-800" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-zinc-900" />
        </div>
        <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      </div>
    </AppLayout>
  );
}
