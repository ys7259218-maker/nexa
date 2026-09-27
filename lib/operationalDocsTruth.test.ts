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

  // Packaged migrations and migrations applied to a hosted project can differ.
  // Check the repo count without requiring staging-only migrations in production.
  const goLiveTrackedCount = /repo chain now tracks \*\*(\d+)\*\*/.exec(goLive);
  assert.ok(goLiveTrackedCount, "docs/GO_LIVE.md must state the tracked repo count");
  assert.equal(Number(goLiveTrackedCount[1]), migrationCount, "docs/GO_LIVE.md tracked repo count drifted");
});

test("operational docs name the actual newest packaged migration", () => {
  assert.ok(newestMigration.endsWith(".sql"), "expected a resolved newest migration");
  assert.ok(
    handoff.includes(`newest \`${newestMigration}\``),
    `NEXA_HANDOFF.md must name the newest migration ${newestMigration}`,
  );
  assert.ok(
    goLive.includes(`newest migration is now \`${newestMigration}\``),
    `docs/GO_LIVE.md must name the newest migration ${newestMigration}`,
  );
});

test("handoff distinguishes observed staging OAuth setup from verified live connection", () => {
  assert.match(handoff, /The owner applied the table to staging through the dashboard/);
  assert.match(handoff, /canonical version is absent from staging migration history/);
  assert.match(handoff, /authenticated OAuth remain unverified/);
  assert.doesNotMatch(handoff, /NOT yet applied to staging|No Google OAuth client has been created/);
});
