import AppLayout from "@/components/layout/AppLayout";

export default function DashboardLoading() {
  return (
    <AppLayout><div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-zinc-900 animate-pulse" />

          <div className="h-10 w-56 rounded-xl bg-zinc-800 animate-pulse" />
        </div>

        <div className="h-12 w-64 rounded-xl bg-zinc-800 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4"
          >
            <div className="h-3 w-24 rounded bg-zinc-900 animate-pulse" />

            <div className="h-10 w-20 rounded bg-zinc-800 animate-pulse" />

            <div className="h-3 w-16 rounded bg-zinc-900 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5"
          >
            <div className="h-6 w-40 rounded bg-zinc-800 animate-pulse" />

            <div className="h-64 rounded-xl bg-zinc-900 animate-pulse" />
          </div>
        ))}
      </div>
    </div></AppLayout>
  );
}
