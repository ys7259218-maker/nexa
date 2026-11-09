import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { AGENT_TASK_TRANSITIONS } from "./fsm.ts";
import {
  AGENT_EVENT_TYPES,
  AGENT_GLOBAL_CONCURRENT_TASK_CAP,
  AGENT_TASK_STATES,
  AGENT_WORKSPACE_CONCURRENT_TASK_CAP,
} from "./types.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261108010000_agent_runtime_b1.sql", import.meta.url),
  "utf8",
);

function between(start: string, end: string): string {
  const startIndex = migration.indexOf(start);
  assert.notEqual(startIndex, -1, `missing migration marker: ${start}`);
  const endIndex = migration.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `missing migration marker: ${end}`);
  return migration.slice(startIndex, endIndex);
}

test("migration is transactional, additive, and creates exactly the four agent tables", () => {
  assert.match(migration, /^begin;/m);
  assert.match(migration, /commit;\s*$/);

  const created = [...migration.matchAll(/create table if not exists public\.([a-z_]+)/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(created.sort(), [
    "agent_events",
    "agent_sessions",
    "agent_task_steps",
    "agent_tasks",
  ]);

  assert.doesNotMatch(migration, /drop table|truncate/i);
  assert.doesNotMatch(migration, /alter table public\.(?!agent_)/i);

  for (const table of ["agent_sessions", "agent_tasks", "agent_task_steps", "agent_events"]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
  }

  assert.match(
    migration,
    /foreign key \(workspace_id, session_id\)[\s\S]+references public\.agent_sessions\(workspace_id, id\)/i,
  );
  assert.match(
    migration,
    /foreign key \(workspace_id, task_id\)[\s\S]+references public\.agent_tasks\(workspace_id, id\)/i,
  );
});

test("authenticated access is select-only and workspace-scoped", () => {
  for (const table of ["agent_sessions", "agent_tasks", "agent_task_steps", "agent_events"]) {
    assert.match(
      migration,
      new RegExp(
        `on public\\.${table} for select to authenticated\\s+using \\(public\\.is_workspace_member\\(workspace_id\\)\\)`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(migration, /for (insert|update|delete)\s+to authenticated/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*to authenticated/i);
  assert.match(
    migration,
    /revoke all privileges on table[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(migration, /grant select on table[\s\S]+to authenticated/i);
});

test("task state and event type allow-lists match the TypeScript contract", () => {
  const stateBlock = between(
    "constraint agent_tasks_state_check check (",
    "constraint agent_tasks_goal_check check",
  );
  const sqlStates = [...stateBlock.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...sqlStates].sort(), [...AGENT_TASK_STATES].sort());

  const eventBlock = between(
    "constraint agent_events_type_check check (",
    "constraint agent_events_task_seq_key",
  );
  const sqlEventTypes = [...eventBlock.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...sqlEventTypes].sort(), [...AGENT_EVENT_TYPES].sort());
  assert.equal(sqlEventTypes.length, 14);
});

test("SQL transition allow-list is exactly the TypeScript FSM", () => {
  const functionBody = between(
    "create or replace function public.agent_task_transition_allowed",
    "revoke all on function public.agent_task_transition_allowed",
  );
  const sqlPairs = new Set(
    [...functionBody.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)'\)/g)].map(
      (match) => `${match[1]}>${match[2]}`,
    ),
  );

  const typescriptPairs = new Set<string>();
  for (const [from, targets] of Object.entries(AGENT_TASK_TRANSITIONS)) {
    for (const to of targets) typescriptPairs.add(`${from}>${to}`);
  }

  assert.deepEqual([...sqlPairs].sort(), [...typescriptPairs].sort());
});

test("claim, heartbeat, transition, and step recording are fail-closed", () => {
  assert.match(migration, /workspace_cap constant integer := 2/);
  assert.match(migration, /global_cap constant integer := 20/);
  assert.equal(AGENT_WORKSPACE_CONCURRENT_TASK_CAP, 2);
  assert.equal(AGENT_GLOBAL_CONCURRENT_TASK_CAP, 20);

  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /t\.cancel_requested = false/);
  assert.match(migration, /t\.deadline_at > now\(\)/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /'task_lease_reclaimed'/);
  assert.match(migration, /'task_claimed'/);

  assert.match(migration, /t\.lease_token = p_lease_token\s+and t\.lease_expires_at > now\(\)/i);
  assert.match(migration, /target\.lease_expires_at is null or target\.lease_expires_at <= now\(\)/i);
  assert.match(
    migration,
    /agent_task_transition_allowed\(p_from_state, p_to_state\)/i,
  );

  assert.match(migration, /step\.status = 'SUCCEEDED'[\s\S]+'already_completed'/i);
  assert.match(migration, /step\.attempts >= 5/);
  assert.match(migration, /'attempts_exhausted'/);
});

test("cooperative cancel is role-guarded and the watchdog records evidence", () => {
  assert.match(
    migration,
    /workspace_has_role\(target\.workspace_id, array\['owner', 'admin', 'operator'\]\)/i,
  );
  assert.match(migration, /target\.created_by = p_actor_user_id/i);
  assert.match(
    migration,
    /request_agent_task_cancel\(p_task_id uuid\)[\s\S]+auth\.uid\(\)/i,
  );

  assert.match(migration, /deadline_at <= now\(\)/i);
  assert.match(migration, /failure_reason = 'deadline_exceeded'/i);
  assert.match(
    migration,
    /evidence = t\.evidence \|\| jsonb_build_object\(\s*'reason', 'deadline_exceeded'/i,
  );
  assert.match(
    migration,
    /cancel_requested = true[\s\S]+lease_token is null or lease_expires_at <= now\(\)/i,
  );
  assert.match(migration, /'task_cancelled'/);
});

test("events are append-only and sequence assignment is serialized per task", () => {
  assert.match(migration, /before update on public\.agent_events/i);
  assert.match(migration, /prevent_agent_event_mutation/i);
  assert.match(migration, /raise exception 'Agent events are append-only'/i);
  assert.match(
    migration,
    /append_agent_event[\s\S]+from public\.agent_tasks[\s\S]+for update[\s\S]+max\(seq\)/i,
  );
  assert.match(migration, /constraint agent_events_task_seq_key unique \(task_id, seq\)/i);
});

test("least-privilege grants expose only reviewed RPCs to the worker role", () => {
  assert.match(migration, /create role nexa_agent_runtime nologin noinherit nobypassrls/i);
  assert.match(migration, /grant usage on schema public to nexa_agent_runtime/i);
  assert.match(
    migration,
    /grant select on table[\s\S]+public\.agent_events\s+to nexa_agent_runtime/i,
  );
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*to nexa_agent_runtime/i);

  const workerFunctions = [
    "public.append_agent_event(uuid, text, jsonb)",
    "public.claim_agent_task(text, integer)",
    "public.heartbeat_agent_task(uuid, uuid, integer)",
    "public.release_agent_task(uuid, uuid)",
    "public.transition_agent_task(uuid, uuid, text, text, text, jsonb)",
    "public.record_agent_step(uuid, uuid, uuid, text, jsonb)",
    "public.request_agent_task_cancel(uuid, uuid)",
    "public.reap_agent_tasks()",
  ];

  for (const signature of workerFunctions) {
    assert.ok(
      migration.includes(
        `revoke all on function ${signature} from public, anon, authenticated`,
      ),
      `${signature} must be revoked from API roles`,
    );
    assert.ok(
      migration.includes(
        `grant execute on function ${signature} to service_role, nexa_agent_runtime`,
      ),
      `${signature} must be executable by the reviewed roles only`,
    );
  }

  assert.ok(
    migration.includes(
      "grant execute on function public.request_agent_task_cancel(uuid) to authenticated, service_role",
    ),
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.request_agent_task_cancel\(uuid, uuid\)[^;]*authenticated/i,
  );
  assert.match(migration, /revoke all on function public\.reap_agent_tasks\(\) from public, anon, authenticated/i);
});
