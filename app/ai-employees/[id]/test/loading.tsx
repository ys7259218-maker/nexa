import AppLayout from "@/components/layout/AppLayout";

export default function AIEmployeeTestLoading() {
  return (
    <AppLayout>
      <div className="space-y-8" aria-busy="true" aria-label="Loading safe AI Employee simulation">
        <div className="space-y-3">
          <div className="h-4 w-44 animate-pulse rounded bg-zinc-800" />
          <div className="h-10 w-72 max-w-full animate-pulse rounded bg-zinc-800" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-zinc-900" />
        </div>
        <div className="h-80 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      </div>
    </AppLayout>
  );
}
