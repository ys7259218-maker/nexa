import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readRequestTextWithLimit, RequestBodyTooLargeError } from "@/lib/requestBody";
import { recordManualAppointmentDecision } from "@/lib/actions/appointmentReviewDecision";
import { canQueueAppointmentReview } from "@/lib/actions/reviewRouteGate";
import { isSameOriginReviewRequest } from "@/lib/actions/reviewOriginGuard";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (!canQueueAppointmentReview({
    APPOINTMENT_REVIEW_STAGING_ENABLED: process.env.APPOINTMENT_REVIEW_STAGING_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  })) return Response.json({ error: "not_found" }, { status: 404, headers });
  if (!isSameOriginReviewRequest(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "invalid_request" }, { status: 415, headers });
  }
  let input: unknown;
  try {
    input = JSON.parse(await readRequestTextWithLimit(request, 1024));
  } catch (error) {
    return Response.json({
      error: error instanceof RequestBodyTooLargeError ? "body_too_large" : "invalid_request",
    }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const params = input as Record<string, unknown>;
  const client = await createSupabaseServerClient();
  if (!client) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const result = await recordManualAppointmentDecision(client, {
    workspaceId: params.workspaceId,
    reviewRequestId: params.reviewRequestId,
    decision: params.decision,
  });
  if (!result.ok) {
    const status = result.error === "invalid_request" ? 400 :
      result.error === "unauthenticated" ? 401 :
      result.error === "not_authorized" ? 404 :
      result.error === "already_decided" ? 409 : 503;
    return Response.json({ error: result.error }, { status, headers });
  }
  return Response.json({ decision: result.decision, booked: false }, { status: 200, headers });
}
