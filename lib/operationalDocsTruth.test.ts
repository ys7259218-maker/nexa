import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const handoff = readFileSync(new URL("../NEXA_HANDOFF.md", import.meta.url), "utf8");
const goLive = readFileSync(new URL("../docs/GO_LIVE.md", import.meta.url), "utf8");

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const newestMigration = migrationFiles[migrationFiles.length - 1] ?? "";
const migrationCount = migrationFiles.length;

test("operational docs reference the exact tracked migration count", () => {
  assert.ok(migrationCount > 0, "expected at least one packaged migration");

  const handoffCount = /tracks \*\*(\d+)\*\* migrations/.exec(handoff);
  assert.ok(handoffCount, "NEXA_HANDOFF.md must state the tracked migration count");
  assert.equal(Number(handoffCount[1]), migrationCount, "NEXA_HANDOFF.md migration count drifted");

  const goLiveChainCount = /\((\d+) migrations in the chain;/.exec(goLive);
  assert.ok(goLiveChainCount, "docs/GO_LIVE.md must state the chain size");
  assert.equal(Number(goLiveChainCount[1]), migrationCount, "docs/GO_LIVE.md chain size drifted");

  const goLiveStepCount = /Apply the (\d+) canonical migrations/.exec(goLive);
  assert.ok(goLiveStepCount, "docs/GO_LIVE.md must state the canonical apply count");
  assert.equal(Number(goLiveStepCount[1]), migrationCount, "docs/GO_LIVE.md canonical apply count drifted");
});

test("operational docs name the actual newest packaged migration", () => {
  assert.ok(newestMigration.endsWith(".sql"), "expected a resolved newest migration");
  assert.match(handoff, new RegExp(`newest \`${newestMigration}\``), "NEXA_HANDOFF.md newest migration drifted");
  assert.match(goLive, new RegExp(`newest migration is now \`${newestMigration}\``), "docs/GO_LIVE.md newest migration drifted");
});