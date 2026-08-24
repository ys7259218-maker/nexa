import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRole } from "./workspaces";

export type TeamMember = { user_id: string; role: WorkspaceRole; created_at: string };
const ROLES: WorkspaceRole[] = ["owner", "admin", "operator", "viewer"];

export async function listTeamMembers(client: SupabaseClient, workspaceId: string) {
  if (!workspaceId) return { data: [] as TeamMember[], error: "Invalid workspace." };
  const { data, error } = await client.from("workspace_members").select("user_id,role,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: true });
  if (error) return { data: [] as TeamMember[], error: "Could not load team members." };
  return { data: (data ?? []) as TeamMember[], error: null };
}

export async function updateTeamMemberRole(client: SupabaseClient, workspaceId: string, userId: string, role: WorkspaceRole) {
  if (!workspaceId || !userId || !ROLES.includes(role)) return { error: "Invalid role update." };
  const { error } = await client.from("workspace_members").update({ role }).eq("workspace_id", workspaceId).eq("user_id", userId);
  return { error: error ? "Could not update this member role." : null };
}

export function maskMemberId(value: string) { return value.length <= 8 ? value : `${value.slice(0, 4)}…${value.slice(-4)}`; }
