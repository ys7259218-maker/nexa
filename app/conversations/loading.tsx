import AppLayout from "@/components/layout/AppLayout";

export default function ConversationsLoading() {
  return (
    <AppLayout>
      <div className="space-y-7 animate-pulse" aria-busy="true" aria-label="Loading conversations">
        <div className="space-y-3">
          <div className="h-10 w-64 rounded-xl bg-zinc-800" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-900" />
        </div>
        <div className="grid min-h-[620px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] lg:grid-cols-[320px_1fr]">
          <div className="space-y-3 border-r border-white/10 p-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 rounded-2xl bg-zinc-900" />)}
          </div>
          <div className="space-y-4 p-6">
            <div className="h-16 rounded-2xl bg-zinc-900" />
            <div className="h-20 w-2/3 rounded-2xl bg-zinc-900" />
            <div className="ml-auto h-20 w-2/3 rounded-2xl bg-zinc-800" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

