import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readRequestTextWithLimit, RequestBodyTooLargeError } from "@/lib/requestBody";
import { queueAppointmentForReview } from "@/lib/actions/appointmentReviewWorkflow";
import { createAppointmentReviewRepository } from "@/lib/actions/appointmentSupabaseRepository";
import { canQueueAppointmentReview } from "@/lib/actions/reviewRouteGate";
import { isSameOriginReviewRequest } from "@/lib/actions/reviewOriginGuard";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  // Intentionally unavailable on production, even if someone copies the flag.
  if (!canQueueAppointmentReview({
    APPOINTMENT_REVIEW_STAGING_ENABLED: process.env.APPOINTMENT_REVIEW_STAGING_ENABLED,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  })) {
    return Response.json({ error: "not_found" }, { status: 404, headers });
  }
  if (!isSameOriginReviewRequest(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "invalid_request" }, { status: 415, headers });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers });
  const { data: actor, error: authError } = await supabase.auth.getUser();
  if (authError || !actor.user?.id) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers });
  }

  let payload: unknown;
  try {
    const body = await readRequestTextWithLimit(request, 4096);
    payload = JSON.parse(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof RequestBodyTooLargeError ? "body_too_large" : "invalid_request" },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const params = payload as Record<string, unknown>;
  // Never accept actorId from the request; only the authenticated session.
  const result = await queueAppointmentForReview({
    actorId: actor.user.id,
    workspaceId: params.workspaceId,
    conversationId: params.conversationId,
    inboundMessageId: params.inboundMessageId,
    requestedAt: params.requestedAt,
    customerRequest: params.customerRequest,
    repository: createAppointmentReviewRepository(supabase),
  });
  if (!result.ok) {
    const status = result.error === "unauthenticated" ? 401 :
      result.error === "invalid_proposal" ? 400 :
      result.error === "not_authorized" ? 404 : 503;
    return Response.json({ error: result.error }, { status, headers });
  }
  return Response.json({ status: "pending_review", booked: false }, { status: 202, headers });
}
