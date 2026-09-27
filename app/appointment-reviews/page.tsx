import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspaces";
import { listPendingAppointmentReviews } from "@/lib/actions/appointmentReviewInbox";
import { listAppointmentReviewDecisions } from "@/lib/actions/appointmentReviewHistory";
import { canQueueAppointmentReview } from "@/lib/actions/reviewRouteGate";
import AppointmentReviewDecisionButtons from "@/components/appointments/AppointmentReviewDecisionButtons";

export const metadata: Metadata = { title: "Appointment requests | Nexa AI" };
export const dynamic = "force-dynamic";

export default async function AppointmentReviewInboxPage() {
  if (!canQueueAppointmentReview({
    APPOINTMENT_REVIEW_STAGING_ENABLED: process.env.APPOINTMENT_REVIEW_STAGING_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  })) notFound();

  await requireAuthenticatedUser();
  const client = await createSupabaseServerClient();
  const workspace = client ? await getCurrentWorkspace(client) : null;
  const result = client && workspace?.data
    ? await listPendingAppointmentReviews(client, workspace.data.id) : null;
  const history = client && workspace?.data
    ? await listAppointmentReviewDecisions(client, workspace.data.id) : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Staging only</p>
          <h1 className="mt-2 text-4xl font-bold">Appointment requests</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Customer requests awaiting human review. These are not confirmed appointments.
            No booking or customer message is triggered from this page.
          </p>
        </div>
        {!result?.ok ? (
          <p role="alert" className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            Pending requests are unavailable for this workspace.
          </p>
        ) : (
          <Card className="space-y-3">
            <p className="text-xs text-zinc-500">Showing up to 30 newest pending requests.</p>
            {result.items.length === 0 ? (
              <p className="py-5 text-sm text-zinc-400">No pending appointment requests.</p>
            ) : result.items.map((item) => (
              <div key={item.id} className="space-y-2 border-b border-zinc-800 py-4 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-300">Pending review</span>
                  <span className="text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">{item.customer_request}</p>
                <p className="text-xs text-zinc-400">Requested time: {new Date(item.requested_at).toLocaleString()}</p>
                <Link className="text-sm text-cyan-300 hover:underline" href={`/conversations?conversation=${encodeURIComponent(item.conversation_id)}`}>
                  View source conversation
                </Link>
                <AppointmentReviewDecisionButtons workspaceId={item.workspace_id} reviewRequestId={item.id} />
              </div>
            ))}
          </Card>
        )}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Recent human decisions</h2>
          <p className="text-sm text-zinc-400">Manual follow-up is not a confirmed appointment. No customer message is sent by these decisions.</p>
          {!history?.ok ? (
            <p role="alert" className="text-sm text-rose-300">Decision history is unavailable.</p>
          ) : (
            <Card className="space-y-3">
              {history.items.length === 0 ? (
                <p className="text-sm text-zinc-400">No human decisions recorded yet.</p>
              ) : history.items.map(item => (
                <div key={item.id} className="border-b border-zinc-800 py-3 last:border-0">
                  <p className="text-sm text-zinc-200">
                    {item.decision === "declined" ? "Declined" : "Marked for manual follow-up — not booked"}
                  </p>
                  <p className="text-xs text-zinc-400">Reviewed {new Date(item.decided_at).toLocaleString()}</p>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
