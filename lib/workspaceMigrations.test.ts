import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync(
  new URL("../docs/migrations/20260824_workspace_tenancy_foundation.sql", import.meta.url),
  "utf8",
);
const cutover = readFileSync(
  new URL("../docs/migrations/20260824_workspace_tenancy_cutover.sql", import.meta.url),
  "utf8",
);

const expectedMigrationChain = [
  "20260824000100_baseline_ai_employees.sql",
  "20260824000200_settings_dashboard.sql",
  "20260824000300_whatsapp_messaging.sql",
  "20260824000400_workspace_tenancy_foundation.sql",
  "20260824000500_workspace_tenancy_cutover.sql",
  "20260824000600_employee_lifecycle.sql",
  "20260824000700_audit_events.sql",
  "20260824000800_workspace_kill_switch.sql",
  "20260824000900_team_role_management.sql",
  "20260824001000_employee_versions.sql",
  "20260824001100_knowledge_v0.sql",
  "20260827183015_whatsapp_channel_assignment.sql",
  "20260829072333_conversation_safety_controls.sql",
  "20260829143000_knowledge_source_registry_v1.sql",
  "20260829162004_knowledge_source_freshness_v1.sql",
] as const;

const copiedMigrationSources = new Map([
  [
    "20260824000400_workspace_tenancy_foundation.sql",
    "20260824_workspace_tenancy_foundation.sql",
  ],
  ["20260824000500_workspace_tenancy_cutover.sql", "20260824_workspace_tenancy_cutover.sql"],
  ["20260824000600_employee_lifecycle.sql", "20260824_employee_lifecycle.sql"],
  ["20260824000700_audit_events.sql", "20260824_audit_events.sql"],
  ["20260824000800_workspace_kill_switch.sql", "20260824_workspace_kill_switch.sql"],
  ["20260824000900_team_role_management.sql", "20260824_team_role_management.sql"],
  ["20260824001000_employee_versions.sql", "20260824_employee_versions.sql"],
  ["20260824001100_knowledge_v0.sql", "20260824_knowledge_v0.sql"],
  [
    "20260827183015_whatsapp_channel_assignment.sql",
    "20260827_whatsapp_channel_assignment.sql",
  ],
  [
    "20260829072333_conversation_safety_controls.sql",
    "20260829_conversation_safety_controls.sql",
  ],
  [
    "20260829143000_knowledge_source_registry_v1.sql",
    "20260829_knowledge_source_registry_v1.sql",
  ],
  [
    "20260829162004_knowledge_source_freshness_v1.sql",
    "20260829_knowledge_source_freshness_v1.sql",
  ],
]);

function normalizeSql(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function firstSqlBlockAfter(markdown: string, heading: string) {
  const headingIndex = markdown.indexOf(heading);
  assert.notEqual(headingIndex, -1, `missing source heading: ${heading}`);
  const fenceStart = markdown.indexOf("```sql", headingIndex);
  assert.notEqual(fenceStart, -1, `missing SQL fence after: ${heading}`);
  const bodyStart = markdown.indexOf("\n", fenceStart) + 1;
  const fenceEnd = markdown.indexOf("\n```", bodyStart);
  assert.notEqual(fenceEnd, -1, `unterminated SQL fence after: ${heading}`);
  return markdown.slice(bodyStart, fenceEnd);
}

test("workspace foundation enforces one immutable creator-owned personal workspace", () => {
  assert.match(foundation, /is_personal boolean not null default false/i);
  assert.match(foundation, /unique index[^;]+created_by[^;]+where is_personal/i);
  assert.match(foundation, /protect_personal_workspace_membership/i);
  assert.match(foundation, /role = any \(array\['owner','admin','operator','viewer'\]::text\[\]\)/i);
  assert.doesNotMatch(foundation, /min\s*\(\s*w\.id\s*\)/i);
});

test("workspace cutover maps legacy rows only through explicit personal identity", () => {
  assert.match(cutover, /w\.created_by\s*=\s*target\.user_id\s+and\s+w\.is_personal/i);
  assert.match(cutover, /mismatched_rows/i);
  assert.doesNotMatch(cutover, /order by created_at(?:\s+asc)?\s+limit 1/i);
  assert.doesNotMatch(cutover, /select workspace_id from public\.workspace_members\s+where user_id/i);
});

test("Supabase migration chain has one explicit monotonically ordered sequence", () => {
  const actual = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  assert.deepEqual(actual, [...expectedMigrationChain]);

  const versions = actual.map((name) => name.slice(0, 14));
  assert.ok(versions.every((version) => /^\d{14}$/.test(version)));
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(versions, [...versions].sort());
});

test("packaged migrations remain identical to their reviewed SQL sources", () => {
  const setup = readFileSync(new URL("../docs/SUPABASE_SETUP.md", import.meta.url), "utf8");
  const embeddedSources = new Map([
    ["20260824000100_baseline_ai_employees.sql", firstSqlBlockAfter(setup, "# Supabase setup")],
    [
      "20260824000200_settings_dashboard.sql",
      firstSqlBlockAfter(setup, "## Settings and dashboard migration (required)"),
    ],
    [
      "20260824000300_whatsapp_messaging.sql",
      firstSqlBlockAfter(setup, "## WhatsApp messaging migration (required before webhook processing)"),
    ],
  ]);

  for (const [targetName, sourceSql] of embeddedSources) {
    const packaged = readFileSync(
      new URL(`../supabase/migrations/${targetName}`, import.meta.url),
      "utf8",
    );
    assert.equal(normalizeSql(packaged), normalizeSql(sourceSql), `${targetName} drifted`);
  }

  for (const [targetName, sourceName] of copiedMigrationSources) {
    const packaged = readFileSync(
      new URL(`../supabase/migrations/${targetName}`, import.meta.url),
      "utf8",
    );
    const reviewedSource = readFileSync(
      new URL(`../docs/migrations/${sourceName}`, import.meta.url),
      "utf8",
    );
    assert.equal(normalizeSql(packaged), normalizeSql(reviewedSource), `${targetName} drifted`);
  }
});

test("employee version history is immutable, bounded, and restored through a guarded RPC", () => {
  const migration = readFileSync(
    new URL("../docs/migrations/20260824_employee_versions.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select to authenticated using \(public\.is_workspace_member\(workspace_id\)\)/i);
  assert.match(migration, /no client write policies/i);
  assert.match(migration, /offset 50/i);
  assert.match(migration, /workspace_has_role[\s\S]+owner[\s\S]+admin[\s\S]+operator/i);
  assert.match(migration, /restore_ai_employee_version/i);
  assert.match(migration, /employee_version_restored/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete)/i);
});

test("Knowledge v0 is employee-scoped, role-guarded, audited, and verified-only", () => {
  const migration = readFileSync(
    new URL("../docs/migrations/20260824_knowledge_v0.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /foreign key \(workspace_id, ai_employee_id\)[\s\S]+references public\.ai_employees\(workspace_id, id\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.knowledge_entries from public, anon/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.knowledge_entries to authenticated/i);
  assert.match(migration, /knowledge_entries_workspace_employee_updated_idx[\s\S]+\(workspace_id, ai_employee_id, updated_at desc\)/i);
  assert.match(migration, /workspace_has_role[\s\S]+owner[\s\S]+admin[\s\S]+operator/i);
  assert.match(migration, /created_by = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /Knowledge entry identity cannot be changed/i);
  assert.match(migration, /create_knowledge_entry[\s\S]+workspace_has_role/i);
  assert.match(migration, /create_knowledge_entry[\s\S]+security definer set search_path = ''/i);
  assert.match(migration, /where verified/i);
  assert.match(migration, /knowledge_entry_(created|updated|deleted)/i);
  assert.doesNotMatch(migration, /service_role/i);
});

test("WhatsApp channel assignment is explicit, workspace-bound, audited, and never guessed", () => {
  const migration = readFileSync(
    new URL("../docs/migrations/20260827_whatsapp_channel_assignment.sql", import.meta.url),
    "utf8",
  );

  assert.match(
    migration,
    /foreign key \(workspace_id, ai_employee_id\)[\s\S]+references public\.ai_employees\(workspace_id, id\)/i,
  );
  assert.match(migration, /on delete set null \(ai_employee_id\)/i);
  assert.match(
    migration,
    /whatsapp_channels_workspace_employee_idx[\s\S]+\(workspace_id, ai_employee_id\)/i,
  );
  assert.match(
    migration,
    /alter table public\.conversations[\s\S]+foreign key \(workspace_id, ai_employee_id\)[\s\S]+references public\.ai_employees\(workspace_id, id\)/i,
  );
  assert.match(
    migration,
    /conversations_workspace_employee_idx[\s\S]+\(workspace_id, ai_employee_id\)/i,
  );
  assert.match(migration, /Cross-workspace conversation assignment exists/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.audit_whatsapp_channel_assignment/i);
  assert.match(migration, /whatsapp_channel_(assigned|unassigned|reassigned)/i);
  assert.match(migration, /jsonb_build_object\('ai_employee_id'/i);
  assert.doesNotMatch(migration, /update\s+public\.whatsapp_channels\s+set\s+ai_employee_id/i);
  assert.doesNotMatch(migration, /order by[\s\S]+created_at[\s\S]+limit 1/i);
});

test("Conversation safety controls are role-guarded, audited, private, and fail closed", () => {
  const migration = readFileSync(
    new URL("../docs/migrations/20260829_conversation_safety_controls.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /automation_mode text not null default 'ai'/i);
  assert.match(migration, /customer_opted_out_at timestamptz/i);
  assert.match(migration, /Conversation safety columns are incompatible/i);
  assert.match(
    migration,
    /safety_updated_by[\s\S]+references auth\.users\(id\) on delete set null/i,
  );
  assert.match(migration, /guard_conversation_safety_write/i);
  assert.match(
    migration,
    /set_conversation_human_takeover[\s\S]+workspace_has_role[\s\S]+owner[\s\S]+admin[\s\S]+operator/i,
  );
  assert.match(
    migration,
    /set_conversation_human_takeover[\s\S]+security definer[\s\S]+set search_path = ''/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.set_conversation_human_takeover[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /mark_conversation_customer_opt_out[\s\S]+grant execute[\s\S]+to service_role/i,
  );
  assert.match(migration, /conversation_human_takeover_(started|ended)/i);
  assert.match(migration, /conversation_customer_opted_out/i);
  assert.match(
    migration,
    /jsonb_build_object[\s\S]+'customer_opted_out'[\s\S]+'source'/i,
  );
  assert.doesNotMatch(
    migration,
    /jsonb_build_object\([^;]*(customer_wa_id|message_body|phone_number)/i,
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(update|insert|delete)\s+on\s+(table\s+)?public\.conversations/i,
  );
});

test("Knowledge Source Registry v1 is metadata-only, workspace-bound, and role-guarded", () => {
  const migration = readFileSync(
    new URL("../docs/migrations/20260829_knowledge_source_registry_v1.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /foreign key \(workspace_id, ai_employee_id\)[\s\S]+references public\.ai_employees\(workspace_id, id\)/i);
  assert.match(migration, /kind in \('website', 'file'\)/i);
  assert.match(migration, /website_url ~ '\^https:\/\//i);
  assert.match(migration, /application\/pdf[\s\S]+text\/plain/i);
  assert.match(migration, /file_size_bytes between 1 and 26214400/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /workspace_has_role[\s\S]+owner[\s\S]+admin[\s\S]+operator/i);
  assert.match(migration, /create_knowledge_source[\s\S]+security definer set search_path = ''/i);
  assert.match(migration, /knowledge_source_(created|deleted)/i);
  assert.doesNotMatch(migration, /jsonb_build_object\([^;]*(website_url|file_name|label)/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update)\s+on\s+(table\s+)?public\.knowledge_sources/i);
});

test("Knowledge source freshness and deletion proof remain content-free and role-guarded", () => {
  const migration = readFileSync(
    new URL("../docs/migrations/20260829_knowledge_source_freshness_v1.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /reviewed_at timestamptz/i);
  assert.match(migration, /review_due_days not between 1 and 365/i);
  assert.match(migration, /knowledge_source_deletion_receipts[\s\S]+enable row level security/i);
  assert.match(migration, /revoke all on table public\.knowledge_source_deletion_receipts from public, anon, authenticated/i);
  assert.match(migration, /workspace_has_role[\s\S]+owner[\s\S]+admin[\s\S]+operator/i);
  assert.match(migration, /revoke delete on table public\.knowledge_sources from authenticated/i);
  assert.match(migration, /delete_knowledge_source[\s\S]+security definer set search_path = ''/i);
  assert.match(migration, /knowledge_source_review_recorded/i);
  assert.doesNotMatch(migration, /jsonb_build_object\([^;]*(website_url|file_name|label)/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)\s+on\s+(table\s+)?public\.knowledge_source_deletion_receipts/i);
});
