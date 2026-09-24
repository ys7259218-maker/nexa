import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { listPendingAppointmentReviews } from "../../lib/actions/appointmentReviewInbox.ts";
import { listAppointmentReviewDecisions } from "../../lib/actions/appointmentReviewHistory.ts";

/**
 * READ-ONLY, credential-gated real Supabase Auth / PostgREST verification.
 *
 * Dedicated staging accounts must have disjoint owner workspaces. This test
 * never inserts conversations/messages, sends outbound communications, books
 * appointments, or accesses production. An empty queue validates authenticated
 * client/RLS query availability, NOT isolation of a populated queue.
 */
const STAGING_URL = "https://vbizuxxgjlwqotuegskq.supabase.co";
const url = process.env.INTEGRATION_SUPABASE_URL;
const anonKey = process.env.INTEGRATION_SUPABASE_ANON_KEY;
const ownerEmail = process.env.INTEGRATION_TEST_EMAIL;
const ownerPassword = process.env.INTEGRATION_TEST_PASSWORD;
const outsiderEmail = process.env.INTEGRATION_TEST_EMAIL_B;
const outsiderPassword = process.env.INTEGRATION_TEST_PASSWORD_B;
const configured = Boolean(anonKey && ownerEmail && ownerPassword &&
  outsiderEmail && outsiderPassword && url === STAGING_URL);

type SessionActor = { client: SupabaseClient; userId: string; workspaceId: string };
async function signedInOwner(email: string, password: string): Promise<SessionActor> {
  const client = createClient(STAGING_URL, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.equal(error, null, "dedicated staging test account must sign in");
  assert.ok(data.user?.id);
  const { data: membership, error: memberError } = await client.from("workspace_members")
    .select("workspace_id").eq("user_id", data.user!.id).eq("role", "owner")
    .limit(1).maybeSingle();
  assert.equal(memberError, null, "owner membership lookup failed");
  assert.ok(membership?.workspace_id, "dedicated staging test account must own a workspace");
  return { client, userId: data.user!.id, workspaceId: membership!.workspace_id };
}
describe("appointment-review real authenticated staging reads", { skip: !configured }, () => {
  it("uses two real, distinct Auth sessions and denies cross-workspace review/history reads", async () => {
    assert.equal(url, STAGING_URL, "never run these tests against production");
    const [owner, outsider] = await Promise.all([
      signedInOwner(ownerEmail!, ownerPassword!),
      signedInOwner(outsiderEmail!, outsiderPassword!),
    ]);
    try {
      assert.notEqual(owner.userId, outsider.userId, "test users must differ");
      assert.notEqual(owner.workspaceId, outsider.workspaceId, "test workspaces must differ");

      const ownInbox = await listPendingAppointmentReviews(owner.client, owner.workspaceId);
      const ownHistory = await listAppointmentReviewDecisions(owner.client, owner.workspaceId);
      assert.equal(ownInbox.ok, true, "authenticated owner should read the staging review inbox");
      assert.equal(ownHistory.ok, true, "authenticated owner should read the staging decision history");

      const outsiderInbox = await listPendingAppointmentReviews(outsider.client, owner.workspaceId);
      const outsiderHistory = await listAppointmentReviewDecisions(outsider.client, owner.workspaceId);
      assert.deepEqual(outsiderInbox, { ok: false, error: "not_authorized" });
      assert.deepEqual(outsiderHistory, { ok: false, error: "not_authorized" });

      const rawReviews = await outsider.client.from("appointment_review_requests")
        .select("id").eq("workspace_id", owner.workspaceId).limit(1);
      const rawDecisions = await outsider.client.from("appointment_review_decisions")
        .select("id").eq("workspace_id", owner.workspaceId).limit(1);
      assert.equal(rawReviews.error, null);
      assert.deepEqual(rawReviews.data, []);
      assert.equal(rawDecisions.error, null);
      assert.deepEqual(rawDecisions.data, []);
    } finally {
      await Promise.all([owner.client.auth.signOut(), outsider.client.auth.signOut()]);
    }
  });
});

// A complete set of credentials pointed at a non-staging target is a config
// error, not evidence that the real-auth integration test was completed.
it("never silently treats fully configured production credentials as staging proof", () => {
  if (anonKey && ownerEmail && ownerPassword && outsiderEmail && outsiderPassword &&
      url && url !== STAGING_URL) {
    assert.fail("appointment integration target must be the exact staging-test project");
  }
});
