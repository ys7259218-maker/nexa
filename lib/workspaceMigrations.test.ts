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
