"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateTeamMemberRole } from "@/lib/teamMembers";
import { canManageWorkspace, type WorkspaceRole } from "@/lib/workspaces";
import SettingsFeedback, { type SettingsMessage } from "@/components/ai/SettingsFeedback";

export default function TeamMemberRole({ workspaceId, userId, role, viewerRole }: { workspaceId: string; userId: string; role: WorkspaceRole; viewerRole: WorkspaceRole }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState(role);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const canManage = canManageWorkspace(viewerRole);

  async function change(next: WorkspaceRole) {
    setSelectedRole(next);
    setMessage(null);
    const client = createSupabaseBrowserClient();
    if (!client) {
      setSelectedRole(role);
      setMessage({ type: "error", text: "Team role controls are temporarily unavailable. Please try again later." });
      return;
    }

    setSaving(true);
    const result = await updateTeamMemberRole(client, workspaceId, userId, next);
    setSaving(false);
    if (result.error) {
      setSelectedRole(role);
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: `Member role changed to ${next}. Database role protections still apply.` });
    router.refresh();
  }

  return <div className="min-w-48 space-y-2" aria-busy={saving}>
    <label htmlFor={`member-role-${userId}`} className="sr-only">Member role</label>
    <select
      id={`member-role-${userId}`}
      value={selectedRole}
      disabled={!canManage || saving}
      aria-describedby={message ? `member-role-${userId}-feedback` : undefined}
      onChange={(event) => change(event.target.value as WorkspaceRole)}
      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-60"
    >
      <option value="owner">Owner</option>
      <option value="admin">Admin</option>
      <option value="operator">Operator</option>
      <option value="viewer">Viewer</option>
    </select>
    {saving ? <p className="text-xs text-zinc-400">Updating role…</p> : null}
    {message ? <SettingsFeedback id={`member-role-${userId}-feedback`} message={message} /> : null}
  </div>;
}
