import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRole } from "./workspaces";

export type WorkspaceSafetyState = { id: string; name: string; role: WorkspaceRole; automationPaused: boolean };

export async function getWorkspaceSafetyState(client: SupabaseClient): Promise<{ data: WorkspaceSafetyState | null; error: string | null }> {
  const { data, error } = await client.from("workspace_members").select("role,workspace:workspaces!inner(id,name,automation_paused,is_personal)").eq("role", "owner").eq("workspace.is_personal", true).maybeSingle();
  if (error || !data) return { data: null, error: "Could not load workspace safety controls." };
  const row = data as unknown as { role: WorkspaceRole; workspace: { id: string; name: string; automation_paused: boolean } };
  return { data: { id: row.workspace.id, name: row.workspace.name, role: row.role, automationPaused: row.workspace.automation_paused }, error: null };
}

export async function setWorkspaceAutomationPaused(client: SupabaseClient, workspaceId: string, paused: boolean) {
  if (!workspaceId) return { error: "Invalid workspace." };
  const { error } = await client.rpc("set_workspace_automation_paused", {
    target_workspace_id: workspaceId,
    paused,
  });
  return { error: error ? "Could not update the workspace safety control." : null };
}
