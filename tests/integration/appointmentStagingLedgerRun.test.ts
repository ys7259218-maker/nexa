import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { executeApprovedAppointmentBooking } from "../../lib/actions/appointmentBooking.ts";
import { SandboxCalendarProvider } from "../../lib/booking/sandboxCalendarProvider.ts";
import {
  createAppointmentBookingLedger,
  loadTrustedBookingAuthorization,
} from "../../lib/server/appointmentBookingStore.ts";

/**
 * GATED live server-only adapter run against the real staging project
 * (vbizuxxgjlwqotuegskq). The go-button for the last booking milestone step.
 *
 * Requires `--conditions=react-server` (see package.json) so it may import
 * the server-only adapter, plus explicit staging credentials:
 *   INTEGRATION_SUPABASE_URL / INTEGRATION_SUPABASE_ANON_KEY / two accounts,
 *   INTEGRATION_SUPABASE_SERVICE_ROLE_KEY
 *
 * Behavior (never mutates real data, never touches production):
 * - Without credentials/ref mismatch: skipped (CI-safe).
 * - Booking ledger tables absent: skipped WITH the exact unblock commands.
 * - Tables present but no seeded fixture chain: skipped with seed instructions.
 * - All present: exercises the real createAppointmentBookingLedger + trusted
 *   authorization + sandbox provider (no external provider, no outbound),
 *   proves confirm + idempotent replay + authenticated-write denial, then
 *   deletes every fixture row it created (cleanup in finally).
 */
const STAGING_URL = "https://vbizuxxgjlwqotuegskq.supabase.co";
const FIXTURE_MARKER = "nexa-staging-fixture:";

const url = process.env.INTEGRATION_SUPABASE_URL;
const anonKey = process.env.INTEGRATION_SUPABASE_ANON_KEY;
const serviceKey = process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.INTEGRATION_TEST_EMAIL;
const ownerPassword = process.env.INTEGRATION_TEST_PASSWORD;
const configured = Boolean(anonKey && serviceKey && ownerEmail && ownerPassword &&
  url === STAGING_URL);

function serviceClient(): SupabaseClient {
  return createClient(STAGING_URL, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Fixture = {
  approvalId: string;
  workspaceId: string;
  reviewId: string;
  decisionId: string;
  confirmationMessageId: string;
  conversationId: string;
};

async function findFixture(service: SupabaseClient): Promise<Fixture | null> {
  const { data, error } = await service
    .from("appointment_booking_approvals")
    .select("id,workspace_id,review_request_id,review_decision_id,customer_confirmation_message_id")
    .limit(20);
  if (error) throw new Error(`fixture lookup unavailable: ${error.message}`);

  type ApprovalRow = {
    id: string;
    workspace_id: string;
    review_request_id: string;
    review_decision_id: string;
    customer_confirmation_message_id: string;
  };
  for (const row of (data ?? []) as ApprovalRow[]) {
    const { data: review, error: reviewError } = await service
      .from("appointment_review_requests")
      .select("conversation_id,customer_request")
      .eq("id", row.review_request_id)
      .maybeSingle();
    if (reviewError) continue;
    if (!String(review?.customer_request).startsWith(FIXTURE_MARKER)) continue;
    return {
      approvalId: row.id,
      workspaceId: row.workspace_id,
      reviewId: row.review_request_id,
      decisionId: row.review_decision_id,
      confirmationMessageId: row.customer_confirmation_message_id,
      conversationId: review!.conversation_id as string,
    };
  }
  return null;
}

async function cleanupFixture(service: SupabaseClient, fx: Fixture): Promise<void> {
  const ids = {
    attempts: fx.reviewId,
    approvals: fx.approvalId,
    decisions: fx.decisionId,
    reviews: fx.reviewId,
    messages: fx.confirmationMessageId,
    conversations: fx.conversationId,
  };
  await service.from("appointment_booking_attempts").delete()
    .eq("review_request_id", ids.attempts);
  await service.from("appointment_booking_approvals").delete()
    .eq("id", ids.approvals);
  await service.from("appointment_review_decisions").delete()
    .eq("id", ids.decisions);
  await service.from("appointment_review_requests").delete().eq("id", ids.reviews);
  await service.from("messages").delete().eq("id", ids.messages);
  await service.from("conversations").delete().eq("id", ids.conversations);
}

describe("staging server-only booking ledger run (gated live evidence)",
  { skip: !configured }, () => {
    it("runs the adapter, confirms + replays idempotently, denies authenticated writes, cleans up",
      async (t) => {
        assert.equal(url, STAGING_URL, "never run the live adapter against production");
        const service = serviceClient();
        let fx: Fixture | null = null;

        // Pre-flight: the booking ledger schema must have been intentionally
        // applied to staging before this step can run.
        const attempts = await service.from("appointment_booking_attempts").select("id").limit(1);
        if (attempts.error) {
          t.skip(
            "booking ledger schema is not applied on staging yet; apply docs/schema-proposals/appointment_booking_ledger_v1.sql (staging dashboard, reversible) then re-run `npm run test:integration:booking-ledger-run`",
          );
          return;
        }
        const approvals = await service.from("appointment_booking_approvals").select("id").limit(1);
        if (approvals.error) {
          t.skip("appointment_booking_approvals not reachable on staging; apply the booking ledger schema first");
          return;
        }

        // Fixture chain must exist (see docs/APPOINTMENT_BOOKING_STAGING_FIXTURE.md).
        fx = await findFixture(service);
        if (!fx) {
          t.skip(
            "no nexa-staging-fixture approval chain seeded; seed it with the fixture SQL in docs/APPOINTMENT_BOOKING_STAGING_FIXTURE.md, then re-run",
          );
          return;
        }

        try {
          const actor = createClient(STAGING_URL, anonKey!, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: session, error: signInError } = await actor.auth.signInWithPassword({
            email: ownerEmail!,
            password: ownerPassword!,
          });
          assert.equal(signInError, null, "dedicated staging test account must sign in");
          assert.ok(session.user?.id);

          const trusted = await loadTrustedBookingAuthorization({
            actorClient: actor,
            workspaceId: fx.workspaceId,
            bookingApprovalId: fx.approvalId,
          });
          assert.equal(trusted.ok, true, "seeded fixture must satisfy the trusted authorization loader");
          if (trusted.ok !== true) return;

          const now = new Date();
          const ledger = createAppointmentBookingLedger(service, fx.approvalId);
          const provider = new SandboxCalendarProvider();

          const first = await executeApprovedAppointmentBooking({
            authorization: trusted.authorization,
            now,
            ledger,
            provider,
          });
          assert.equal(first.ok, true, "first live adapter run must confirm");
          if (first.ok !== true) return;
          assert.equal(first.status, "confirmed");
          assert.equal(first.replayed, false);

          const replay = await executeApprovedAppointmentBooking({
            authorization: trusted.authorization,
            now,
            ledger,
            provider,
          });
          assert.equal(replay.ok, true, "idempotent replay must confirm");
          if (replay.ok !== true) return;
          assert.equal(replay.replayed, true, "replay must reuse the stored booking");
          assert.equal(replay.booking.providerBookingId, first.booking.providerBookingId);

          const stored = await service.from("appointment_booking_attempts")
            .select("status,provider,provider_booking_id,starts_at")
            .eq("review_request_id", fx.reviewId)
            .maybeSingle();
          assert.equal(stored.error, null);
          assert.equal(stored.data?.status, "confirmed");
          assert.equal(stored.data?.provider, "sandbox");

          // Authenticated (non-service) writes must remain denied by RLS even
          // with the schema applied.
          const denied = await actor.from("appointment_booking_attempts").insert({
            workspace_id: fx.workspaceId,
            review_request_id: fx.reviewId,
            booking_approval_id: fx.approvalId,
            idempotency_key: "nexa:staging:must-be-denied",
            status: "claimed",
            provider: null,
            provider_booking_id: null,
            starts_at: null,
            failure_code: null,
          });
          assert.ok(denied.error, "authenticated direct ledger write must fail closed");

          await actor.auth.signOut();
        } finally {
          if (fx) await cleanupFixture(service, fx);
        }
      });
  });

// A complete set of credentials pointed at a non-staging target is a config
// error, not live adapter evidence.
it("never silently treats production credentials as staging adapter proof", () => {
  if (anonKey && serviceKey && ownerEmail && ownerPassword && url && url !== STAGING_URL) {
    assert.fail("booking adapter integration must target the exact staging-test project");
  }
});