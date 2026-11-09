import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TOOL_ERROR_CLASSES,
  TOOL_INVOCATION_STATUSES,
  TOOL_RISK_TIERS,
  TOOL_TIMEOUT_CLASSES,
} from "./types.ts";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20261109010000_agent_tool_registry_b2.sql",
    import.meta.url,
  ),
  "utf8",
);

const TABLES = ["agent_tool_manifests", "agent_tool_invocations"];

function compactSql(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ",");
}

const compact = compactSql(migration);

test("migration is transactional, additive, and creates exactly the two tool tables", () => {
  assert.match(migration, /^begin;/m);
  assert.match(migration, /commit;\s*$/);

  const created = [
    ...migration.matchAll(/create table if not exists public\.([a-z_]+)/g),
  ].map((match) => match[1]);
  assert.deepEqual(created.sort(), [...TABLES].sort());

  assert.doesNotMatch(migration, /drop table|truncate/i);
  assert.doesNotMatch(migration, /alter table public\.(?!agent_tool_)/i);
});

test("RLS is enabled and authenticated reads are workspace-scoped", () => {
  for (const table of TABLES) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(
      migration,
      new RegExp(
        `create policy[^;]+on public\\.${table} for select to authenticated\\s+using \\(public\\.is_workspace_member\\(workspace_id\\)\\)`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(migration, /for (insert|update|delete)\s+to authenticated/i);
  assert.doesNotMatch(
    migration,
    /grant (insert|update|delete)[^;]*to authenticated/i,
  );
});

test("invocations are append-only and sequence-safe", () => {
  assert.match(
    migration,
    /create trigger prevent_agent_tool_invocation_update\s+before update or delete on public\.agent_tool_invocations/i,
  );
  assert.match(
    migration,
    /prevent_agent_tool_invocation_mutation[\s\S]+raise exception 'Agent tool invocations are append-only'/i,
  );
  assert.match(
    migration,
    /agent_tool_invocations_workspace_invocation_attempt_key unique \(\s*workspace_id, invocation_key, attempt\s*\)/i,
  );
});

test("manifest table rejects unknown fields, bad classes, and duplicate versions", () => {
  assert.match(
    migration,
    /manifest\s*-\s*'name'[\s\S]+-\s*'outputSchema'\s*\)\s*=\s*'\{\}'::jsonb/i,
  );
  assert.match(
    migration,
    /coalesce\(manifest->>'timeoutClass', ''\) in \('fast', 'standard', 'long'\)/i,
  );
  assert.match(
    migration,
    /coalesce\(manifest->>'maxAttempts', ''\) ~ '\^\[1-3\]\$'/i,
  );
  assert.match(
    migration,
    /coalesce\(manifest->>'riskTier', ''\) in \('T0', 'T1'\)/i,
  );
  assert.match(
    migration,
    /agent_tool_manifests_workspace_tool_key unique \(\s*workspace_id, tool_name, tool_version\s*\)/i,
  );
  assert.match(migration, /manifest_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
});

test("invocation audit constraints encode the full error taxonomy and outcome", () => {
  for (const errorClass of TOOL_ERROR_CLASSES) {
    assert.ok(
      migration.includes(`'${errorClass}'`),
      `missing error class ${errorClass}`,
    );
  }
  for (const timeoutClass of TOOL_TIMEOUT_CLASSES) {
    assert.ok(
      migration.includes(`'${timeoutClass}'`),
      `missing timeout class ${timeoutClass}`,
    );
  }
  for (const status of TOOL_INVOCATION_STATUSES) {
    assert.ok(migration.includes(`'${status}'`), `missing status ${status}`);
  }
  for (const riskTier of TOOL_RISK_TIERS) {
    assert.ok(migration.includes(`'${riskTier}'`), `missing risk tier ${riskTier}`);
  }

  assert.match(
    migration,
    /status = 'SUCCEEDED' and error_class is null and output_hash is not null/i,
  );
  assert.match(
    migration,
    /status = 'FAILED' and error_class is not null and output_hash is null/i,
  );
  assert.match(migration, /attempt between 1 and 3/i);
  assert.match(migration, /duration_ms between 0 and 600000/i);
});

test("both mutation RPCs are SECURITY DEFINER with an empty search path", () => {
  for (const functionName of [
    "upsert_agent_tool_manifest",
    "record_agent_tool_invocation",
  ]) {
    const block = migration.slice(
      migration.indexOf(`create or replace function public.${functionName}`),
    );
    assert.ok(block.length > 0, `missing ${functionName}`);
    const bodyStart = block.indexOf("language plpgsql");
    assert.ok(bodyStart > 0, `missing language for ${functionName}`);
    assert.match(
      block.slice(0, bodyStart + 100),
      /security definer[\s\S]*set search_path = ''/i,
    );
  }
});

test("invocation RPC requires an enabled matching manifest and same-workspace references", () => {
  assert.match(
    migration,
    /from public\.agent_tool_manifests m[\s\S]+m\.workspace_id = p_workspace_id[\s\S]+m\.tool_name = p_tool_name[\s\S]+m\.tool_version = p_tool_version[\s\S]+m\.manifest_hash = p_manifest_hash[\s\S]+m\.enabled = true/i,
  );
  assert.match(migration, /'manifest_missing'/);
  assert.match(
    migration,
    /from public\.agent_tasks t[\s\S]+t\.id = p_task_id and t\.workspace_id = p_workspace_id/i,
  );
  assert.match(migration, /'task_workspace_mismatch'/);
  assert.match(
    migration,
    /from public\.agent_task_steps s[\s\S]+s\.id = p_step_id and s\.workspace_id = p_workspace_id/i,
  );
  assert.match(migration, /'step_workspace_mismatch'/);
});

test("manifest RPC validates shape before upsert and keeps writes RPC-only", () => {
  assert.match(migration, /'invalid_manifest'/);
  assert.match(migration, /'invalid_manifest_hash'/);
  assert.match(
    migration,
    /insert into public\.agent_tool_manifests[\s\S]+on conflict \(workspace_id, tool_name, tool_version\) do update/i,
  );

  assert.match(
    migration,
    /revoke all privileges on table[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select on table[\s\S]+to authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /grant (insert|update|delete)[^;]*to (authenticated|service_role|nexa_agent_runtime)/i,
  );
});

test("worker and service roles receive only reviewed RPC execution", () => {
  assert.match(migration, /create role nexa_agent_runtime nologin noinherit nobypassrls/i);
  assert.match(migration, /grant usage on schema public to nexa_agent_runtime/i);
  assert.match(
    migration,
    /grant select on table[\s\S]+to nexa_agent_runtime/i,
  );

  const signatures = [
    "public.upsert_agent_tool_manifest(uuid, text, text, jsonb, text, uuid)",
    "public.record_agent_tool_invocation(uuid, text, text, text, text, text, text, text, text, integer, integer, text, uuid, uuid)",
  ];
  for (const signature of signatures) {
    const compactSignature = compactSql(signature);
    assert.ok(
      compact.includes(
        `revoke all on function ${compactSignature} from public,anon,authenticated`,
      ),
      `${signature} must be revoked from API roles`,
    );
    assert.ok(
      compact.includes(
        `grant execute on function ${compactSignature} to service_role,nexa_agent_runtime`,
      ),
      `${signature} must be executable by reviewed roles only`,
    );
  }

  assert.doesNotMatch(
    migration,
    /grant execute on function public\.(upsert_agent_tool_manifest|record_agent_tool_invocation)[^;]*authenticated/i,
  );
});
