import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const config = readFileSync(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);
const verifier = readFileSync(
  new URL("../scripts/verifyLocalSupabase.ts", import.meta.url),
  "utf8",
);

test("Supabase CLI and local config are pinned to reviewed safe defaults", () => {
  assert.equal(packageJson.devDependencies.supabase, "2.116.0");
  assert.equal(packageJson.scripts["verify:supabase:local"], "node scripts/verifyLocalSupabase.ts");
  assert.match(config, /^project_id\s*=\s*"nexa"\s*$/m);
  assert.match(config, /^major_version\s*=\s*17\s*$/m);
  assert.match(config, /^auto_expose_new_tables\s*=\s*true\s*$/m);
  assert.match(config, /\[db\.seed\][\s\S]*?^enabled\s*=\s*false\s*$/m);
  assert.match(config, /^minimum_password_length\s*=\s*12\s*$/m);
  assert.doesNotMatch(config, /sbp_|sb_secret_|service_role\s*=|access_token\s*=/i);
});

test("local verifier refuses hosted links and uses only local database commands", () => {
  assert.match(verifier, /\.temp", "project-ref"/);
  assert.match(verifier, /linked to a hosted project/);
  assert.equal((verifier.match(/"db", "reset", "--local", "--no-seed"/g) ?? []).length, 2);
  assert.match(verifier, /"db", "lint", "--local"/);
  assert.match(verifier, /"migration", "list", "--local"/);
  assert.doesNotMatch(verifier, /"--linked"|"db", "push"|"link", "--project-ref"/);
});
