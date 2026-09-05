import AppLayout from "@/components/layout/AppLayout";

export default function NotificationsLoading() {
  return (
    <AppLayout>
      <div className="space-y-7 animate-pulse" aria-busy="true" aria-label="Loading notifications">
        <div className="space-y-3">
          <div className="h-10 w-64 rounded-xl bg-zinc-800" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-900" />
        </div>
        <div className="h-24 rounded-3xl bg-zinc-900/60" />
        <div className="h-24 rounded-3xl bg-zinc-900/60" />
      </div>
    </AppLayout>
  );
}