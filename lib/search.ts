import type { SupabaseClient } from "@supabase/supabase-js";
import { maskWhatsAppId } from "./conversations.ts";

export type SearchGroupId =
  | "ai_employees"
  | "conversations"
  | "messages"
  | "calls"
  | "appointments";

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type SearchResultGroup = {
  id: SearchGroupId;
  label: string;
  allHref: string;
  items: SearchResultItem[];
};

export type SearchResult = {
  groups: SearchResultGroup[];
  total: number;
};

export type SearchResultOutcome =
  | { data: SearchResult; error: null }
  | { data: null; error: string };

const MAX_QUERY_LENGTH = 100;

/**
 * Strips characters that would either widen the match (`%`, `_`) or break the
 * `.or()` filter string its value is embedded in, then collapses whitespace.
 */
export function sanitizeLikeTerm(query: string): string {
  return query
    .replace(/[\\%_"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function orIlike(columns: string[], value: string): string {
  return columns.map((column) => `${column}.ilike."${value}"`).join(",");
}

function snippet(value: string, max = 80): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

/**
 * Searches across the signed-in user's AI employees, conversations, message
 * bodies, call records, and appointments. Every read runs through the user's
 * cookie session, so RLS keeps results scoped to the owner; the service-role
 * key is never used here. Matching is a simple case-insensitive containment
 * check per column set; there is no full-text ranking.
 */
export async function searchWorkspace(
  client: SupabaseClient,
  query: string,
): Promise<SearchResultOutcome> {
  const term = sanitizeLikeTerm(query);

  if (term.length === 0) {
    return { data: { groups: [], total: 0 }, error: null };
  }

  const like = `%${term}%`;

  const [employeesResult, conversationsResult, messagesResult, callsResult, appointmentsResult] =
    await Promise.all([
      client
        .from("ai_employees")
        .select("id,name,business_name,department")
        .or(orIlike(["name", "business_name", "department"], like))
        .limit(5),
      client
        .from("conversations")
        .select("id,customer_wa_id,last_message_at")
        .ilike("customer_wa_id", like)
        .limit(5),
      client
        .from("messages")
        .select("id,conversation_id,body,direction,status")
        .ilike("body", like)
        .limit(5),
      client
        .from("calls")
        .select("id,customer,status,duration_seconds")
        .ilike("customer", like)
        .limit(5),
      client
        .from("appointments")
        .select("id,customer,service,location,scheduled_at")
        .or(orIlike(["customer", "service", "location"], like))
        .limit(5),
    ]);

  const firstError =
    employeesResult.error ??
    conversationsResult.error ??
    messagesResult.error ??
    callsResult.error ??
    appointmentsResult.error;

  if (firstError) {
    return { data: null, error: firstError.message };
  }

  const groups: SearchResultGroup[] = [];

  const employees = (employeesResult.data ?? []) as Array<{
    id: string;
    name: string;
    business_name: string;
    department: string;
  }>;

  if (employees.length > 0) {
    groups.push({
      id: "ai_employees",
      label: "AI Employees",
      allHref: "/ai-employees",
      items: employees.map((employee) => ({
        id: employee.id,
        title: employee.name,
        subtitle: [employee.business_name, employee.department].filter(Boolean).join(" · "),
        href: `/ai-employees/${employee.id}`,
      })),
    });
  }

  const conversations = (conversationsResult.data ?? []) as Array<{
    id: string;
    customer_wa_id: string;
    last_message_at: string;
  }>;

  if (conversations.length > 0) {
    groups.push({
      id: "conversations",
      label: "Conversations",
      allHref: "/conversations",
      items: conversations.map((conversation) => ({
        id: conversation.id,
        title: `WhatsApp contact ${maskWhatsAppId(conversation.customer_wa_id)}`,
        subtitle: `Last message ${new Date(conversation.last_message_at).toLocaleString()}`,
        href: `/conversations?conversation=${encodeURIComponent(conversation.id)}`,
      })),
    });
  }

  const messages = (messagesResult.data ?? []) as Array<{
    id: string;
    conversation_id: string;
    body: string;
    direction: string;
    status: string;
  }>;

  if (messages.length > 0) {
    groups.push({
      id: "messages",
      label: "Messages",
      allHref: "/conversations",
      items: messages.map((message) => ({
        id: message.id,
        title: snippet(message.body),
        subtitle: `${message.direction} message · ${message.status}`,
        href: `/conversations?conversation=${encodeURIComponent(message.conversation_id)}`,
      })),
    });
  }

  const calls = (callsResult.data ?? []) as Array<{
    id: string;
    customer: string;
    status: string;
    duration_seconds: number;
  }>;

  if (calls.length > 0) {
    groups.push({
      id: "calls",
      label: "Call records",
      allHref: "/dashboard#calls",
      items: calls.map((call) => ({
        id: call.id,
        title: call.customer,
        subtitle: `${call.status} · ${call.duration_seconds}s`,
        href: "/dashboard#calls",
      })),
    });
  }

  const appointments = (appointmentsResult.data ?? []) as Array<{
    id: string;
    customer: string;
    service: string;
    location: string;
    scheduled_at: string;
  }>;

  if (appointments.length > 0) {
    groups.push({
      id: "appointments",
      label: "Appointments",
      allHref: "/dashboard#appointments",
      items: appointments.map((appointment) => ({
        id: appointment.id,
        title: appointment.customer,
        subtitle: [
          appointment.service,
          appointment.location || "",
          new Date(appointment.scheduled_at).toLocaleString(),
        ]
          .filter(Boolean)
          .join(" · "),
        href: "/dashboard#appointments",
      })),
    });
  }

  return {
    data: { groups, total: groups.reduce((sum, group) => sum + group.items.length, 0) },
    error: null,
  };
}