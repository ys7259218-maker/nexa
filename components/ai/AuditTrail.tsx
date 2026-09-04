import Card from "../ui/Card";
import { auditActionLabel, auditEventDetail, type AuditEvent } from "@/lib/auditEvents";

export default function AuditTrail({ events }: { events: AuditEvent[] }) {
  return (
    <Card className="space-y-5">
      <div><h2 className="text-2xl font-bold">Safety audit history</h2><p className="mt-1 text-zinc-400">Immutable lifecycle and automation-control events.</p></div>
      {events.length === 0 ? <p className="text-sm text-zinc-500">No lifecycle changes recorded yet.</p> : (
        <div className="space-y-3">{events.map((event) => (
          <div key={event.id} className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0">
            <div><p className="font-medium">{auditActionLabel(event.action)}</p><p className="text-sm text-zinc-500">{auditEventDetail(event)}</p></div>
            <time className="shrink-0 text-xs text-zinc-500" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
          </div>
        ))}</div>
      )}
    </Card>
  );
}
