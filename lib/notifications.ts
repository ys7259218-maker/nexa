import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationTone = "danger" | "warning" | "info";

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: NotificationTone;
};

export type NotificationsResult =
  | { data: NotificationItem[]; error: null }
  | { data: null; error: string };

/**
 * Derives an actionable notification feed from the signed-in user's stored
 * state, in priority order. Everything is read through the cookie session, so
 * RLS scopes the data to the owner; the service-role key is never used here.
 * Notifications are computed at request time — there is no separate table to
 * keep in sync and nothing can grow stale.
 */
export async function getNotifications(
  client: SupabaseClient,
): Promise<NotificationsResult> {
  const [draftsResult, conversationsResult, employeesResult, channelsResult] = await Promise.all([
    client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "draft_blocked"),
    client.from("conversations").select("id", { count: "exact", head: true }),
    client.from("ai_employees").select("id"),
    client.from("whatsapp_channels").select("ai_employee_id"),
  ]);

  const firstError =
    draftsResult.error ??
    conversationsResult.error ??
    employeesResult.error ??
    channelsResult.error;

  if (firstError) {
    return { data: null, error: firstError.message };
  }

  const items: NotificationItem[] = [];

  const pendingDrafts = draftsResult.count ?? 0;
  if (pendingDrafts > 0) {
    items.push({
      id: "pending-drafts",
      title: `${pendingDrafts} AI draft${pendingDrafts === 1 ? "" : "s"} pending review`,
      detail:
        "Inbound conversations have drafted replies that need a human before they can be sent.",
      href: "/conversations",
      tone: "danger",
    });
  }

  const openConversations = conversationsResult.count ?? 0;
  if (openConversations > 0) {
    items.push({
      id: "open-conversations",
      title: `${openConversations} open conversation${openConversations === 1 ? "" : "s"}`,
      detail: "WhatsApp contacts may be waiting for a reply.",
      href: "/conversations",
      tone: "info",
    });
  }

  const employees = (employeesResult.data ?? []) as Array<{ id: string }>;
  const linkedEmployeeIds = new Set(
    (channelsResult.data ?? [])
      .map((channel) => channel.ai_employee_id)
      .filter((id): id is string => Boolean(id)),
  );
  const unlinkedEmployees = employees.filter(
    (employee) => !linkedEmployeeIds.has(employee.id),
  ).length;

  if (unlinkedEmployees > 0) {
    items.push({
      id: "unlinked-employees",
      title: `${unlinkedEmployees} AI employee${unlinkedEmployees === 1 ? "" : "s"} with no WhatsApp channel`,
      detail: "Link a channel before an employee can handle inbound conversations.",
      href: "/ai-employees",
      tone: "warning",
    });
  }

  return { data: items, error: null };
}