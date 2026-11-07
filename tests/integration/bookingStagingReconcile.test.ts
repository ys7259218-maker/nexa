import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * READ-ONLY, credential-gated booking-schema reconcile against the real
 * staging project (vbizuxxgjlwqotuegskq).
 *
 * Proves, against the live staging DB: the appointment review-queue stack and
 * staging-applied booking ledger tables are present and authenticated-readable.
 * This is not a complete schema-parity or booking-flow test.
 *
 * Makes no DDL, no booking, no outbound send, no production access, no real
 * customer data. Skips without explicit staging credentials.
 */
const STAGING_URL = "https://vbizuxxgjlwqotuegskq.supabase.co";
const url = process.env.INTEGRATION_SUPABASE_URL;
const anonKey = process.env.INTEGRATION_SUPABASE_ANON_KEY;
const ownerEmail = process.env.INTEGRATION_TEST_EMAIL;
const ownerPassword = process.env.INTEGRATION_TEST_PASSWORD;
const configured = Boolean(anonKey && ownerEmail && ownerPassword &&
  url === STAGING_URL);

function signIn(anon: string, email: string, password: string): SupabaseClient {
  return createClient(STAGING_URL, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("staging booking-schema reconcile (read-only)", { skip: !configured }, () => {
  it("keeps the review queue and staging booking ledger readable", async () => {
    assert.equal(url, STAGING_URL, "never run these tests against production");
    const client = signIn(anonKey!, ownerEmail!, ownerPassword!);
    const { data: user, error: userError } = await client.auth.signInWithPassword({
      email: ownerEmail!,
      password: ownerPassword!,
    });
    assert.equal(userError, null, "dedicated staging test account must sign in");
    assert.ok(user.user?.id);

    // Present, authenticated-readable review stack on staging.
    const reviewRequest = await client.from("appointment_review_requests")
      .select("id").limit(1);
    assert.equal(reviewRequest.error, null, "review queue table must exist on staging");
    assert.equal(reviewRequest.data.length, 0, "staging review queue must be empty (no real data)");

    const reviewDecision = await client.from("appointment_review_decisions")
      .select("id").limit(1);
    assert.equal(reviewDecision.error, null, "review decision table must exist on staging");
    assert.equal(reviewDecision.data.length, 0);

    const invokerView = await client.from("pending_appointment_review_inbox")
      .select("id").limit(1);
    assert.equal(invokerView.error, null, "pending review invoker view must exist on staging");
    assert.equal(invokerView.data.length, 0);

    // The booking ledger was applied to staging after the original absence
    // reconcile. This read-only probe checks availability, not write access.
    for (const table of ["appointment_booking_approvals", "appointment_booking_attempts"]) {
      const result = await client.from(table).select("id").limit(1);
      assert.equal(result.error, null, `${table} must be readable on staging`);
      assert.equal(result.data.length, 0, `${table} must have no fixture residue`);
    }
  });
});

// A complete set of credentials pointed at a non-staging target is a config
// error, not evidence that the staging reconcile was completed.
it("never silently treats fully configured production credentials as staging reconcile proof", () => {
  if (anonKey && ownerEmail && ownerPassword && url && url !== STAGING_URL) {
    assert.fail("booking staging reconcile must target the exact staging-test project");
  }
});
