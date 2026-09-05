export default function AIEmployeeDetailsLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading AI Employee">
      <div className="space-y-2">
        <div className="h-10 w-72 rounded-xl bg-zinc-800 animate-pulse" />

        <div className="h-4 w-80 rounded bg-zinc-900 animate-pulse" />
      </div>

      {[0, 1].map((index) => (
        <div
          key={index}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6"
        >
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-zinc-800 animate-pulse" />

            <div className="h-3 w-64 rounded bg-zinc-900 animate-pulse" />
          </div>

          <div className="space-y-5">
            {[0, 1, 2].map((field) => (
              <div
                key={field}
                className="h-12 w-full rounded-xl bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
