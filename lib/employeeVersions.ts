import type { SupabaseClient } from "@supabase/supabase-js";

import type { AIEmployee } from "./aiEmployees";

export type VersionedAIEmployeeField =
  | "name"
  | "business_name"
  | "phone"
  | "voice"
  | "language"
  | "department"
  | "business_description"
  | "greeting_message"
  | "timezone"
  | "working_hours"
  | "accent"
  | "speaking_style"
  | "speaking_speed"
  | "tone"
  | "country"
  | "business_hours"
  | "call_forwarding_number"
  | "call_routing_rule"
  | "knowledge_website"
  | "knowledge_faq_document"
  | "knowledge_pdf_url"
  | "knowledge_notes";

export type EmployeeVersionSnapshot = Pick<AIEmployee, VersionedAIEmployeeField>;

export type EmployeeVersion = {
  id: string;
  workspace_id: string;
  ai_employee_id: string;
  created_by: string | null;
  change_source: "migration_baseline" | "settings_update" | "restore";
  snapshot: EmployeeVersionSnapshot;
  created_at: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEmployeeVersionId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 36 && UUID_PATTERN.test(value);
}

export async function listEmployeeVersions(
  client: SupabaseClient,
  employeeId: string,
  limit = 20,
): Promise<{ data: EmployeeVersion[]; error: string | null }> {
  if (!isValidEmployeeVersionId(employeeId) || limit < 1 || limit > 50) {
    return { data: [], error: "Invalid employee version request." };
  }

  const { data, error } = await client
    .from("ai_employee_versions")
    .select("id,workspace_id,ai_employee_id,created_by,change_source,snapshot,created_at")
    .eq("ai_employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [], error: "Could not load employee version history." };
  }

  return { data: (data ?? []) as EmployeeVersion[], error: null };
}

export async function restoreEmployeeVersion(
  client: SupabaseClient,
  employeeId: string,
  versionId: string,
): Promise<{ error: string | null }> {
  if (!isValidEmployeeVersionId(employeeId) || !isValidEmployeeVersionId(versionId)) {
    return { error: "Invalid employee version restore request." };
  }

  const { error } = await client.rpc("restore_ai_employee_version", {
    target_employee_id: employeeId,
    target_version_id: versionId,
  });

  return {
    error: error ? "Could not restore this employee version." : null,
  };
}

export function employeeVersionSourceLabel(source: EmployeeVersion["change_source"]): string {
  if (source === "migration_baseline") return "Migration baseline";
  if (source === "restore") return "State saved before restore";
  return "Settings snapshot";
}
