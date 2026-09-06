import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { auditActionLabel, listWorkspaceAuditEvents, type AuditEvent } from "@/lib/auditEvents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log | Nexa AI" };

function OutboundRow({ event }: { event: AuditEvent }) {
  const template =
    typeof event.metadata.template_name === "string" && event.metadata.template_name
      ? event.metadata.template_name
      : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
          <p className="font-medium text-emerald-200">{auditActionLabel(event.action)}</p>
        </div>
        <p className="text-sm text-zinc-400">A human-approved outbound message was sent{template ? ` via template "${template}"` : " via free-form text"}.</p>
      </div>
      <time className="shrink-0 text-xs text-zinc-500" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
    </div>
  );
}

export default async function AuditLogPage() {
  await requireAuthenticatedUser();
  const client = await createSupabaseServerClient();
  if (!client) return <AppLayout><Card><h1 className="text-2xl font-bold">Audit log unavailable</h1><p className="mt-2 text-red-300">The workspace data connection is not configured.</p></Card></AppLayout>;
  const events = await listWorkspaceAuditEvents(client, { entityType: "message", limit: 50 });
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</p>
          <h1 className="mt-2 text-4xl font-bold">Audit log</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">Immutable record of human-approved outbound WhatsApp sends, scoped to your workspace.</p>
        </div>
        {events.error ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-300">Audit log could not be loaded</h2>
            <p className="text-zinc-400">{events.error}</p>
          </Card>
        ) : events.data.length === 0 ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold">No sends recorded yet</h2>
            <p className="text-zinc-400">When you approve and send a draft, it will appear here with its template reference and timestamp.</p>
          </Card>
        ) : (
          <Card className="space-y-1">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-xl font-semibold">Outbound sends</h2>
              <span className="text-xs text-zinc-500">{events.data.length} shown</span>
            </div>
            {events.data.map((event) => (
              <OutboundRow key={event.id} event={event} />
            ))}
            <p className="pt-3 text-xs text-zinc-600">Read-only. Rows are written by the outbound processor and cannot be edited or deleted in-app.</p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
