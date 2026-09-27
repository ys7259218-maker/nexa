import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260927000000_calendar_oauth_connections.sql", import.meta.url),
  "utf8",
);

test("migration creates the connection ledger with explicit token columns", () => {
  assert.match(migration, /create table public\.calendar_oauth_connections/);
  assert.match(migration, /workspace_id uuid not null unique references public\.workspaces\(id\) on delete cascade/);
  assert.match(migration, /access_token_encrypted text not null/);
  assert.match(migration, /refresh_token_encrypted text not null/);
});

test("RLS is enabled with browser clients restricted to select only", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.calendar_oauth_connections from anon, authenticated/);
  assert.match(migration, /grant select on public\.calendar_oauth_connections to authenticated/);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)[^;]*to authenticated/i);
});

test("connection rows are readable only by owner/admin members via the workspace role function", () => {
  assert.match(migration, /workspace_has_role\(calendar_oauth_connections\.workspace_id, array\['owner','admin'\]\)/);
});

test("calendar id is optional and never defaults to a primary calendar", () => {
  assert.match(migration, /calendar_id text check \(calendar_id is null or char_length\(calendar_id\) between 3 and 255\)/);
  assert.doesNotMatch(migration, /calendar_id[^\n]*default/i);
  assert.doesNotMatch(migration, /default\s+['"]primary['"]/i);
});

test("migration is a plain additive begin/commit block with no security definer", () => {
  assert.match(migration, /begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /security\s+definer|security_definer/i);
});