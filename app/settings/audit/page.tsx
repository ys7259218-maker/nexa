import type { Metadata } from "next";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
  auditActionLabel,
  auditEventDetail,
  AUDIT_ENTITY_TYPES,
  entityTypeLabel,
  listWorkspaceAuditEvents,
  parseAuditEntityFilter,
  type AuditEvent,
} from "@/lib/auditEvents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log | Nexa AI" };

type AuditLogPageProps = {
  searchParams: Promise<{ entity?: string }>;
};

const ENTITY_CHIP: Record<AuditEvent["entity_type"], string> = {
  ai_employee: "bg-cyan-500/10 text-cyan-300",
  workspace: "bg-violet-500/10 text-violet-300",
  integration: "bg-amber-500/10 text-amber-300",
  message: "bg-emerald-500/10 text-emerald-300",
};

function AuditRow({ event }: { event: AuditEvent }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full bg-zinc-500`} aria-hidden="true" />
          <p className="font-medium text-zinc-200">{auditActionLabel(event.action)}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ENTITY_CHIP[event.entity_type]}`}>
            {entityTypeLabel(event.entity_type)}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">{auditEventDetail(event)}</p>
      </div>
      <time className="shrink-0 text-xs text-zinc-500" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-cyan-500 text-black"
          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  await requireAuthenticatedUser();
  const { entity } = await searchParams;
  const entityFilter = parseAuditEntityFilter(entity);
  const client = await createSupabaseServerClient();
  if (!client) return <AppLayout><Card><h1 className="text-2xl font-bold">Audit log unavailable</h1><p className="mt-2 text-red-300">The workspace data connection is not configured.</p></Card></AppLayout>;
  const events = await listWorkspaceAuditEvents(client, { entityType: entityFilter, limit: 50 });
  const shownLabel = entityFilter ? entityTypeLabel(entityFilter) : "All events";
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</p>
          <h1 className="mt-2 text-4xl font-bold">Audit log</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">Immutable audit trail for your workspace, filterable by entity type.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Filter audit events">
          <FilterChip href="/settings/audit" label="All" active={entityFilter === undefined} />
          {AUDIT_ENTITY_TYPES.map((type) => (
            <FilterChip
              key={type}
              href={`/settings/audit?entity=${type}`}
              label={entityTypeLabel(type)}
              active={entityFilter === type}
            />
          ))}
        </div>
        {events.error ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-300">Audit log could not be loaded</h2>
            <p className="text-zinc-400">{events.error}</p>
          </Card>
        ) : events.data.length === 0 ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold">No events for {shownLabel.toLowerCase()}</h2>
            <p className="text-zinc-400">When actions occur it will appear here with its label, entity type, and timestamp.</p>
          </Card>
        ) : (
          <Card className="space-y-1">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-xl font-semibold">{shownLabel}</h2>
              <span className="text-xs text-zinc-500">{events.data.length} shown</span>
            </div>
            {events.data.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))}
            <p className="pt-3 text-xs text-zinc-600">Read-only. Rows are written by the workspace processor and cannot be edited or deleted in-app.</p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}