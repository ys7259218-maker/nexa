import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canQueueAppointmentReview } from "./reviewRouteGate.ts";

const stagingUrl = "https://vbizuxxgjlwqotuegskq.supabase.co";
test("staging route defaults off without an explicit flag", () => {
  assert.equal(canQueueAppointmentReview({ NEXT_PUBLIC_SUPABASE_URL: stagingUrl }), false);
});
test("staging route enables only against the exact staging project", () => {
  assert.equal(canQueueAppointmentReview({ APPOINTMENT_REVIEW_STAGING_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: stagingUrl }), true);
});
test("production, spoofed domains, protocol and malformed URLs all fail closed", () => {
  for (const url of [
    "https://nkxhlugrprdtqyqcahfx.supabase.co",
    "https://vbizuxxgjlwqotuegskq.supabase.co.evil.example",
    "http://vbizuxxgjlwqotuegskq.supabase.co",
    "https://vbizuxxgjlwqotuegskq.supabase.co/other",
    "not-a-url",
    "",
  ]) {
    assert.equal(canQueueAppointmentReview({ APPOINTMENT_REVIEW_STAGING_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: url }), false);
  }
});
test("staging endpoint requires session user, bounded request body, and never calls a booking or outbound sender", () => {
  const route = readFileSync(new URL("../../app/api/appointment-reviews/route.ts", import.meta.url), "utf8");
  assert.match(route, /canQueueAppointmentReview\(\{[\s\S]*APPOINTMENT_REVIEW_STAGING_ENABLED: process\.env\.APPOINTMENT_REVIEW_STAGING_ENABLED,[\s\S]*NEXT_PUBLIC_SUPABASE_URL: process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(route, /VERCEL_ENV: process\.env\.VERCEL_ENV/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /readRequestTextWithLimit\(request, 4096\)/);
  assert.match(route, /actorId: actor\.user\.id/);
  assert.match(route, /createAppointmentReviewRepository\(supabase\)/);
  assert.match(route, /status: "pending_review", booked: false/);
  assert.doesNotMatch(route, /service.role|createServiceClient|sendWhatsApp|from\(["']appointments["']\)/);
});

test("Vercel production refuses review writes even if staging URL and flag are copied", () => {
  assert.equal(canQueueAppointmentReview({ APPOINTMENT_REVIEW_STAGING_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: stagingUrl, VERCEL_ENV: "production" }), false);
  assert.equal(canQueueAppointmentReview({ APPOINTMENT_REVIEW_STAGING_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: stagingUrl, VERCEL_ENV: "preview" }), true);
});
test("staging gate refuses URLs with query strings, hashes, or credentials", () => {
  for (const url of [stagingUrl + "?x=1", stagingUrl + "#fragment", "https://test@" + stagingUrl.slice(8)]) {
    assert.equal(canQueueAppointmentReview({ APPOINTMENT_REVIEW_STAGING_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: url }), false);
  }
});
