import AppLayout from "@/components/layout/AppLayout";

export default function SearchLoading() {
  return (
    <AppLayout>
      <div className="space-y-7 animate-pulse" aria-busy="true" aria-label="Loading search">
        <div className="space-y-3">
          <div className="h-10 w-40 rounded-xl bg-zinc-800" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-900" />
        </div>
        <div className="h-16 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="h-full rounded-xl bg-zinc-900" />
        </div>
        <div className="h-40 rounded-3xl bg-zinc-900/60" />
        <div className="h-40 rounded-3xl bg-zinc-900/60" />
      </div>
    </AppLayout>
  );
}