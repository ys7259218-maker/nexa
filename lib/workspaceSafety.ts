import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRole } from "./workspaces";

export type WorkspaceSafetyState = { id: string; name: string; role: WorkspaceRole; automationPaused: boolean };

export async function getWorkspaceSafetyState(client: SupabaseClient): Promise<{ data: WorkspaceSafetyState | null; error: string | null }> {
  const { data, error } = await client.from("workspace_members").select("role,workspace:workspaces!inner(id,name,automation_paused)").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error || !data) return { data: null, error: "Could not load workspace safety controls." };
  const row = data as unknown as { role: WorkspaceRole; workspace: { id: string; name: string; automation_paused: boolean } };
  return { data: { id: row.workspace.id, name: row.workspace.name, role: row.role, automationPaused: row.workspace.automation_paused }, error: null };
}

export async function setWorkspaceAutomationPaused(client: SupabaseClient, workspaceId: string, paused: boolean) {
  if (!workspaceId) return { error: "Invalid workspace." };
  const { error } = await client.from("workspaces").update({ automation_paused: paused }).eq("id", workspaceId);
  return { error: error ? "Could not update the workspace safety control." : null };
}
