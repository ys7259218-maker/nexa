import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEvent = {
  id: string;
  entity_type: "ai_employee" | "workspace" | "integration";
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listEmployeeAuditEvents(client: SupabaseClient, employeeId: string, limit = 20): Promise<{ data: AuditEvent[]; error: string | null }> {
  if (!employeeId || limit < 1 || limit > 50) return { data: [], error: "Invalid audit history request." };
  const { data, error } = await client
    .from("audit_events")
    .select("id,entity_type,entity_id,action,metadata,created_at")
    .eq("entity_type", "ai_employee")
    .eq("entity_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: "Could not load audit history." };
  return { data: (data ?? []) as AuditEvent[], error: null };
}

export function auditActionLabel(action: string): string {
  return ({ lifecycle_changed: "Lifecycle changed", automation_paused: "Emergency pause engaged", automation_resumed: "Automation resumed", employee_version_restored: "Settings version restored", knowledge_entry_created: "Knowledge entry created", knowledge_entry_updated: "Knowledge entry updated", knowledge_entry_deleted: "Knowledge entry deleted" } as Record<string, string>)[action] ?? "Safety setting changed";
}

export function auditEventDetail(event: Pick<AuditEvent, "action" | "metadata">): string {
  const from = typeof event.metadata.from_status === "string" ? event.metadata.from_status : null;
  const to = typeof event.metadata.to_status === "string" ? event.metadata.to_status : null;
  if (from && to && from !== to) {
    return `${from} → ${to}`;
  }
  if (from) {
    return `Now ${from}`;
  }
  return ({
    automation_paused: "Automation is paused until explicitly resumed.",
    automation_resumed: "Automation is running again.",
    employee_version_restored: "A settings version was restored.",
    knowledge_entry_created: "Knowledge entry was added.",
    knowledge_entry_updated: "Knowledge entry was updated.",
    knowledge_entry_deleted: "Knowledge entry was removed.",
  } as Record<string, string>)[event.action] ?? "No status transition.";
}
