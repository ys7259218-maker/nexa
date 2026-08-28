import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const configPath = resolve(projectRoot, "supabase", "config.toml");
const linkedProjectMarker = resolve(projectRoot, "supabase", ".temp", "project-ref");
const cli = process.platform === "win32" ? "supabase.cmd" : "supabase";

function fail(message: string): never {
  console.error(`Local Supabase verification blocked: ${message}`);
  process.exit(1);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(" ")} did not complete successfully.`);
  }
}

if (!existsSync(configPath)) {
  fail("supabase/config.toml is missing.");
}

if (existsSync(linkedProjectMarker)) {
  fail("this checkout is linked to a hosted project; use a clean unlinked checkout.");
}

const config = readFileSync(configPath, "utf8");
if (!/^project_id\s*=\s*"nexa"\s*$/m.test(config)) {
  fail("the local project id is not the reviewed Nexa value.");
}

const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
  cwd: projectRoot,
  encoding: "utf8",
  shell: false,
});
if (docker.error || docker.status !== 0 || !docker.stdout.trim()) {
  fail("Docker Desktop is not installed or its engine is not running.");
}

console.log("Starting an unlinked local database and applying the canonical migrations twice.");
run(cli, ["db", "start"]);
run(cli, ["db", "reset", "--local", "--no-seed"]);
run(cli, ["db", "reset", "--local", "--no-seed"]);
run(cli, ["db", "lint", "--local", "--level", "warning", "--fail-on", "error"]);
run(cli, ["migration", "list", "--local"]);
console.log("Local Supabase migration verification passed. The local database remains running.");
