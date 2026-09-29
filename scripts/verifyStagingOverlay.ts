import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const configPath = resolve(projectRoot, "supabase", "config.toml");
const linkedProjectMarker = resolve(projectRoot, "supabase", ".temp", "project-ref");
const cliEntrypoint = resolve(projectRoot, "node_modules", "supabase", "dist", "supabase.js");
const migrationsDir = resolve(projectRoot, "supabase", "migrations");
const overlayFiles = [
  "docs/staging-applied/20260924172517_appointment_review_queue_staging_v1.sql",
  "docs/staging-applied/20260924180931_appointment_human_decision_staging_v1.sql",
  "docs/staging-applied/20260925_pending_appointment_review_invoker_view.sql",
  "docs/schema-proposals/appointment_booking_ledger_v1.sql",
];

function fail(message: string): never {
  console.error(`Staging overlay replay blocked: ${message}`);
  process.exit(1);
}

function run(args: string[]) {
  const result = spawnSync(process.execPath, [cliEntrypoint, ...args], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    fail(`supabase ${args.join(" ")} did not complete successfully.`);
  }
}

function runSqlFile(relativePath: string) {
  // db query uses a prepared statement and rejects a multi-statement SQL
  // file. psql inside the freshly reset local DB container executes the
  // tracked BEGIN/COMMIT file as written and fails at the first SQL error.
  const result = spawnSync("docker", [
    "exec", "-i", "supabase_db_nexa", "psql", "-X", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres",
  ], {
    cwd: projectRoot,
    input: readFileSync(resolve(projectRoot, relativePath), "utf8"),
    stdio: ["pipe", "inherit", "inherit"],
    shell: false,
  });
  if (result.error || result.status !== 0) {
    fail(`local psql replay failed for ${relativePath}.`);
  }
}

// This script resets a database. Its only supported target is a disposable
// unlinked GitHub Actions runner after verifyLocalSupabase has started Docker.
if (process.env.CI !== "true" || process.env.GITHUB_ACTIONS !== "true") {
  fail("run only on a disposable GitHub Actions runner (CI and GITHUB_ACTIONS required).");
}
if (!existsSync(configPath) || !existsSync(cliEntrypoint)) {
  fail("reviewed local Supabase config or installed CLI is missing.");
}
if (existsSync(linkedProjectMarker)) {
  fail("checkout is linked to a hosted project.");
}
if (!/^project_id\s*=\s*"nexa"\s*$/m.test(readFileSync(configPath, "utf8"))) {
  fail("local project id is not the reviewed Nexa value.");
}
for (const relativePath of overlayFiles) {
  if (!existsSync(resolve(projectRoot, relativePath))) {
    fail(`tracked overlay SQL is missing: ${relativePath}`);
  }
}
const canonicalCount = readdirSync(migrationsDir)
  .filter((filename) => /^\d{14}_.+\.sql$/.test(filename)).length;
if (canonicalCount === 0) fail("no canonical migrations found.");

// --local is explicit on every command. A third reset gives the overlay a
// separate clean canonical base; the historical four-value audit bridge is
// intentionally omitted because canonical audit normalization supersedes it.
run(["db", "reset", "--local", "--no-seed"]);
run(["db", "query", "--local", `
do $preflight$
begin
  if exists (select 1 from public.messages) then
    raise exception 'disposable database unexpectedly contains messages';
  end if;
  if to_regclass('public.appointment_review_requests') is not null
    or to_regclass('public.appointment_review_decisions') is not null
    or to_regclass('public.pending_appointment_review_inbox') is not null
    or to_regclass('public.appointment_booking_approvals') is not null
    or to_regclass('public.appointment_booking_attempts') is not null then
    raise exception 'staging overlay objects exist before replay';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> ${canonicalCount} then
    raise exception 'canonical migration history count differs from source';
  end if;
end $preflight$;
`]);

for (const relativePath of overlayFiles) {
  runSqlFile(relativePath);
}

run(["db", "query", "--local", `
do $postflight$
declare
  table_name text;
begin
  foreach table_name in array array[
    'appointment_review_requests',
    'appointment_review_decisions',
    'appointment_booking_approvals',
    'appointment_booking_attempts'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=table_name
        and c.relkind='r' and c.relrowsecurity
    ) then
      raise exception 'overlay table missing or RLS disabled: %', table_name;
    end if;
  end loop;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='pending_appointment_review_inbox'
      and c.relkind='v' and 'security_invoker=true'=any(c.reloptions)
  ) then
    raise exception 'pending inbox view missing or not security invoker';
  end if;
  if has_table_privilege('anon','public.pending_appointment_review_inbox','SELECT')
    or has_table_privilege('authenticated','public.appointment_booking_attempts','INSERT')
    or has_table_privilege('authenticated','public.appointment_booking_attempts','UPDATE')
    or has_table_privilege('authenticated','public.appointment_booking_attempts','DELETE') then
    raise exception 'overlay client privileges are broader than reviewed';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> ${canonicalCount} then
    raise exception 'overlay unexpectedly changed canonical migration history';
  end if;
end $postflight$;
`]);

console.log("Disposable canonical-plus-staging overlay replay passed; no hosted database was changed.");
