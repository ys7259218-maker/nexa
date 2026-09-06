import type { SupabaseClient } from "@supabase/supabase-js";

export type OutboundStatusFilter =
  | "all"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "draft_blocked";

const VALID_OUTBOUND_STATUSES: Exclude<OutboundStatusFilter, "all">[] = [
  "sent",
  "delivered",
  "read",
  "failed",
  "draft_blocked",
];

export type OutboundTemplateFilter = "all" | "freeform" | "template";

/**
 * Validates an unknown (search-param) template filter and returns a typed one,
 * defaulting to "all" for absent or unknown input. Never trusts raw strings.
 */
export function parseOutboundTemplateFilter(value: unknown): OutboundTemplateFilter {
  return value === "freeform" || value === "template" ? value : "all";
}

/**
 * Validates an unknown (search-param) status filter and returns a typed one,
 * defaulting to "all" for absent or unknown input. Never trusts raw strings.
 */
export function parseOutboundStatusFilter(value: unknown): OutboundStatusFilter {
  return VALID_OUTBOUND_STATUSES.includes(value as Exclude<OutboundStatusFilter, "all">)
    ? (value as Exclude<OutboundStatusFilter, "all">)
    : "all";
}

export interface OutboundRecord {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  template_name: string | null;
  message_type: string;
  body: string;
  status: "sent" | "delivered" | "read" | "failed" | "draft_blocked";
  sent_at: string | null;
  created_at: string;
}

export type OutboundHistoryResult =
  | { data: OutboundRecord[]; error: null }
  | { data: null; error: string };

/**
 * Reads the owner's outbound messages (RLS-scoped, signed-in client, no
 * service-role key) newest first, optionally restricted to a single status
 * and/or whether a template reference was recorded.
 */
export async function listOutboundHistory(
  client: SupabaseClient,
  filter: OutboundStatusFilter = "all",
  templateFilter: OutboundTemplateFilter = "all",
  limit = 60,
): Promise<OutboundHistoryResult> {
  let query = client
    .from("messages")
    .select("*")
    .eq("direction", "outbound");

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  if (templateFilter === "template") {
    query = query.not("template_name", "is", null);
  } else if (templateFilter === "freeform") {
    query = query.is("template_name", null);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as OutboundRecord[], error: null };
}

/**
 * A safe, single-line preview of a message body. Long bodies are truncated at
 * the word boundary so dense text does not blow up list rows.
 */
export function previewBody(body: string, maxChars = 96): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}