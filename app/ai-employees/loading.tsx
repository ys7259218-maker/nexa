import AppLayout from "@/components/layout/AppLayout";

export default function AIEmployeesLoading() {
  return (
    <AppLayout><div className="space-y-8" aria-busy="true" aria-label="Loading AI employees">
      <div className="space-y-2">
        <div className="h-10 w-64 rounded-xl bg-zinc-800 animate-pulse" />

        <div className="h-4 w-96 rounded bg-zinc-900 animate-pulse" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-zinc-800 animate-pulse" />

              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 rounded bg-zinc-800 animate-pulse" />

                <div className="h-3 w-24 rounded bg-zinc-900 animate-pulse" />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-7 w-20 rounded-full bg-zinc-800 animate-pulse" />

              <div className="h-7 w-20 rounded-full bg-zinc-800 animate-pulse" />
            </div>

            <div className="h-11 w-full rounded-xl bg-zinc-800 animate-pulse" />
          </div>
        ))}
      </div>
    </div></AppLayout>
  );
}
