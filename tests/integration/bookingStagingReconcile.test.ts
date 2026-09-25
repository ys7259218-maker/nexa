import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * READ-ONLY, credential-gated booking-schema reconcile against the real
 * staging project (vbizuxxgjlwqotuegskq).
 *
 * Proves, against the live staging DB: the appointment review-queue stack is
 * present and authenticated-readable; the proposed booking ledger tables
 * (`appointment_booking_approvals`, `appointment_booking_attempts`) do NOT
 * exist yet, so the server-only booking adapter fails closed at the boundary
 * and no booking ledger write is possible on staging.
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
  it("keeps the review queue readable while the booking ledger stays absent on staging", async () => {
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

    // Proposal-only booking ledger: the tables must NOT be reachable yet.
    for (const table of ["appointment_booking_approvals", "appointment_booking_attempts"]) {
      const result = await client.from(table).select("id").limit(1);
      assert.ok(
        result.error,
        `${table} must not exist on staging until the booking schema is intentionally applied`,
      );
      assert.match(
        String(result.error.message),
        /could not find the table|does not exist|relation/i,
        `${table} absence should surface as a clear PostgREST error`,
      );
    }

    // Fail-closed evidence: a direct INSERT to the absent ledger is refused.
    const insert = await client.from("appointment_booking_attempts").insert({
      workspace_id: user.user!.id,
      review_request_id: user.user!.id,
      booking_approval_id: user.user!.id,
      idempotency_key: "nexa:probe:must-not-persist",
      status: "claimed",
    });
    assert.ok(insert.error, "booking ledger insert must fail closed on staging");
  });
});

// A complete set of credentials pointed at a non-staging target is a config
// error, not evidence that the staging reconcile was completed.
it("never silently treats fully configured production credentials as staging reconcile proof", () => {
  if (anonKey && ownerEmail && ownerPassword && url && url !== STAGING_URL) {
    assert.fail("booking staging reconcile must target the exact staging-test project");
  }
});