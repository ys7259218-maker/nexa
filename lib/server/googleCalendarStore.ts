import "server-only";
import { normalizeStagingCalendarId } from "../calendar/googleCalendarGate";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only persistence for the staging Google Calendar OAuth connection.
 *
 * Token rows are written, updated, and deleted ONLY through the service-role
 * client (RLS bypassed); authenticated clients are never granted INSERT or
 * UPDATE on `calendar_oauth_connections`, so browser code can never touch the
 * stored tokens. Authenticated reads (status) go through the actor's RLS-scoped
 * client and are sanitized to exclude every token field.
 */

const NAMES = {
  connections: "calendar_oauth_connections",
  members: "workspace_members",
} as const;

/** The actor's owner/admin workspace, read through their RLS-scoped session. */
export async function findActorOwnerWorkspace(
  actor: SupabaseClient,
  actorId: string,
): Promise<{ ok: true; workspaceId: string } | { ok: false; error: "not_authorized" | "unavailable" }> {
  const { data, error } = await actor
    .from(NAMES.members)
    .select("workspace_id")
    .eq("user_id", actorId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!data) return { ok: false, error: "not_authorized" };
  const workspaceId = (data as { workspace_id: string }).workspace_id;
  return typeof workspaceId === "string" ? { ok: true, workspaceId } : { ok: false, error: "unavailable" };
}

/** Owner/admin check for a specific workspace, through the actor's session. */
export async function actorIsOwnerOrAdminOf(
  actor: SupabaseClient,
  actorId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data, error } = await actor
    .from(NAMES.members)
    .select("role")
    .eq("user_id", actorId)
    .eq("workspace_id", workspaceId)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  return !error && Boolean(data);
}

export type SavedConnection = Readonly<{
  workspaceId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  scopes: string;
  tokenExpiresAt: string;
  connectedByUserId: string;
}>;

export async function saveGoogleCalendarConnection(input: {
  service: SupabaseClient;
  connection: SavedConnection;
}): Promise<{ ok: true } | { ok: false; error: "unavailable_invalid" | "write_unavailable" }> {
  const { service, connection } = input;
  const { workspaceId } = connection;
  if (!workspaceId || !connection.accessTokenEncrypted || !connection.refreshTokenEncrypted) {
    return { ok: false, error: "unavailable_invalid" };
  }
  const existing = await service
    .from(NAMES.connections)
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (existing.error) return { ok: false, error: "write_unavailable" };

  const now = new Date().toISOString();
  const row = {
    workspace_id: workspaceId,
    provider: "google_calendar",
    access_token_encrypted: connection.accessTokenEncrypted,
    refresh_token_encrypted: connection.refreshTokenEncrypted,
    scopes: connection.scopes,
    token_expires_at: connection.tokenExpiresAt,
    connected_by_user_id: connection.connectedByUserId,
    updated_at: now,
  };

  let write;
  if (existing.data) {
    write = await service
      .from(NAMES.connections)
      .update(row)
      .eq("workspace_id", workspaceId)
      .select("id")
      .maybeSingle();
  } else {
    write = await service
      .from(NAMES.connections)
      .insert(row)
      .select("id")
      .maybeSingle();
  }
  if (write.error || !write.data) return { ok: false, error: "write_unavailable" };
  return { ok: true };
}

export async function configureGoogleCalendarId(input: {
  service: SupabaseClient;
  workspaceId: string;
  calendarId: string;
}): Promise<{ ok: true; calendarId: string } | { ok: false; error: "write_unavailable" }> {
  const calendarId = normalizeStagingCalendarId(input.calendarId);
  if (!calendarId) return { ok: false, error: "write_unavailable" };
  const updated = await input.service
    .from(NAMES.connections)
    .update({ calendar_id: calendarId, updated_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .select("id")
    .maybeSingle();
  if (updated.error || !updated.data) return { ok: false, error: "write_unavailable" };
  return { ok: true, calendarId };
}

export async function disconnectGoogleCalendar(input: {
  service: SupabaseClient;
  workspaceId: string;
}): Promise<{ ok: true } | { ok: false; error: "write_unavailable" }> {
  const removed = await input.service
    .from(NAMES.connections)
    .delete()
    .eq("workspace_id", input.workspaceId)
    .select("id")
    .maybeSingle();
  if (removed.error) return { ok: false, error: "write_unavailable" };
  return { ok: true };
}

export type CalendarConnectionStatus = Readonly<{
  connected: boolean;
  provider: string | null;
  calendarId: string | null;
  scopes: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
}>;

/** Sanitized status via the actor's RLS-scoped client; never includes tokens. */
export async function readCalendarConnectionStatus(
  actor: SupabaseClient,
  workspaceId: string,
): Promise<{ ok: true; status: CalendarConnectionStatus | null } | { ok: false; error: "unavailable" }> {
  const select = "provider,calendar_id,scopes,token_expires_at,connected_at";
  const { data, error } = await actor
    .from(NAMES.connections)
    .select(select)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) return { ok: false, error: "unavailable" };
  if (!data) return { ok: true, status: null };
  const row = data as {
    provider: string | null;
    calendar_id: string | null;
    scopes: string | null;
    token_expires_at: string | null;
    connected_at: string | null;
  };
  return {
    ok: true,
    status: {
      connected: true,
      provider: row.provider,
      calendarId: row.calendar_id,
      scopes: row.scopes,
      tokenExpiresAt: row.token_expires_at,
      connectedAt: row.connected_at,
    },
  };
}