"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateTeamMemberRole } from "@/lib/teamMembers";
import { canManageWorkspace, type WorkspaceRole } from "@/lib/workspaces";

export default function TeamMemberRole({ workspaceId, userId, role, viewerRole }: { workspaceId: string; userId: string; role: WorkspaceRole; viewerRole: WorkspaceRole }) {
  const router = useRouter(); const [saving, setSaving] = useState(false); const canManage = canManageWorkspace(viewerRole);
  async function change(next: WorkspaceRole) {
    const client = createSupabaseBrowserClient(); if (!client) return;
    setSaving(true); const result = await updateTeamMemberRole(client, workspaceId, userId, next); setSaving(false);
    if (!result.error) router.refresh();
  }
  return <select aria-label="Member role" value={role} disabled={!canManage || saving} onChange={(event) => change(event.target.value as WorkspaceRole)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-60">
    <option value="owner">Owner</option><option value="admin">Admin</option><option value="operator">Operator</option><option value="viewer">Viewer</option>
  </select>;
}
