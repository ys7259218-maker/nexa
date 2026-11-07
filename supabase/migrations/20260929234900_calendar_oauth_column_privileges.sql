-- Owners/admins may inspect connection status, never encrypted token material.
-- Keep row-level workspace scoping from 20260927000000 in force. The server's
-- service_role retains its existing privileges for token rotation and deletion.
begin;

revoke select on table public.calendar_oauth_connections
  from public, anon, authenticated;

grant select (
  id, workspace_id, provider, calendar_id, scopes, token_expires_at,
  connected_by_user_id, connected_at, updated_at
) on table public.calendar_oauth_connections to authenticated;

commit;
