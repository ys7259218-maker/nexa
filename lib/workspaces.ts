import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceRole = "owner" | "admin" | "operator" | "viewer";

export type CurrentWorkspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

export type WorkspaceResult =
  | { data: CurrentWorkspace; error: null }
  | { data: null; error: string };

type MembershipRow = {
  role: WorkspaceRole;
  workspace: { id: string; name: string; is_personal: boolean } | null;
};

export async function getCurrentWorkspace(client: SupabaseClient): Promise<WorkspaceResult> {
  const { data, error } = await client
    .from("workspace_members")
    .select("role, workspace:workspaces!inner(id,name,is_personal)")
    .eq("role", "owner")
    .eq("workspace.is_personal", true)
    .maybeSingle();

  if (error) {
    return { data: null, error: "Could not load your workspace." };
  }

  const membership = data as unknown as MembershipRow | null;
  if (!membership?.workspace) {
    return { data: null, error: "No workspace is assigned to this account." };
  }

  return {
    data: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      role: membership.role,
    },
    error: null,
  };
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export function canOperateWorkspace(role: WorkspaceRole): boolean {
  return role !== "viewer";
}
