import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * GATED read-only reconcile of staging's recorded Supabase migration history
 * vs the canonical chain in supabase/migrations (docs/staging-applied SQL and
 * docs/schema-proposals are intentionally outside canonical history).
 *
 * Requires the staging operator to first run the snapshot block in
 * docs/APPOINTMENT_BOOKING_STAGING_FIXTURE.md (Step 4). Reads nothing but the
 * snapshot table; writes nothing; never touches production. Skips when there
 * are no credentials or no snapshot yet.
 */
const STAGING_URL = "https://vbizuxxgjlwqotuegskq.supabase.co";
const url = process.env.INTEGRATION_SUPABASE_URL;
const anonKey = process.env.INTEGRATION_SUPABASE_ANON_KEY;
const ownerEmail = process.env.INTEGRATION_TEST_EMAIL;
const ownerPassword = process.env.INTEGRATION_TEST_PASSWORD;
const configured = Boolean(anonKey && ownerEmail && ownerPassword && url === STAGING_URL);

function canonicalVersions(): string[] {
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  return files.map((f) => f.replace(/\.sql$/, "")).sort();
}

async function stagedVersions(client: SupabaseClient): Promise<{ ok: boolean; versions: string[]; reason?: string }> {
  const { data, error } = await client.from("staging_migrations_snapshot")
    .select("version").order("version", { ascending: true });
  if (error) return { ok: false, versions: [], reason: error.message };
  return { ok: true, versions: (data ?? []).map((r) => String(r.version)) };
}

async function signedInOwner(): Promise<SupabaseClient> {
  const client = createClient(STAGING_URL, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: ownerEmail!,
    password: ownerPassword!,
  });
  assert.equal(error, null, "dedicated staging test account must sign in");
  return client;
}

describe("staging migration-history reconcile (read-only)", { skip: !configured }, () => {
  it("reads the staging snapshot and diffs it against canonical history", async (t) => {
    assert.equal(url, STAGING_URL, "never run these tests against production");
    const client = await signedInOwner();
    try {
      const staged = await stagedVersions(client);
      if (!staged.ok) {
        t.skip(
          "staging_migrations_snapshot not available; run Step 4 in docs/APPOINTMENT_BOOKING_STAGING_FIXTURE.md, then re-run",
        );
        return;
      }
      const canonical = canonicalVersions();
      const stagedSet = new Set(staged.versions);
      const canonicalSet = new Set(canonical);
      const missingOnStaging = canonical.filter((v) => !stagedSet.has(v));
      const extraOnStaging = staged.versions.filter((v) => !canonicalSet.has(v));
      t.diagnostic(`canonical=${canonical.length} staged=${staged.versions.length}`);
      t.diagnostic(`missing_on_staging=${JSON.stringify(missingOnStaging)}`);
      t.diagnostic(`extra_on_staging=${JSON.stringify(extraOnStaging)}`);
      assert.ok(staged.versions.length > 0, "snapshot must be non-empty");
    } finally {
      await client.auth.signOut();
    }
  });
});

// A complete set of credentials pointed at a non-staging target is a config
// error, not migration-history reconcile evidence.
it("never silently treats production credentials as migration reconcile proof", () => {
  if (anonKey && ownerEmail && ownerPassword && url && url !== STAGING_URL) {
    assert.fail("migration reconcile must target the exact staging-test project");
  }
});