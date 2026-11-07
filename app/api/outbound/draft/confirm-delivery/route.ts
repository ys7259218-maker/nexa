import { getAuthenticatedUser } from "@/lib/auth";
import { readRequestTextWithLimit, RequestBodyTooLargeError } from "@/lib/requestBody";
import { createSupabaseServiceClient } from "@/lib/server/whatsappProcessor";
import { confirmDraftDelivered, isValidDraftMessageId } from "@/lib/server/draftSender";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await readRequestTextWithLimit(request, MAX_BODY_BYTES));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body too large" }, { status: 413 });
    }
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messageId = (body as { messageId?: unknown }).messageId;
  if (!isValidDraftMessageId(messageId)) {
    return Response.json({ error: "Invalid message id" }, { status: 400 });
  }

  // Recording a delivery is irreversible in the UI and suppresses any resend, so
  // the operator must state that they saw the message arrive.
  if ((body as { confirmDelivered?: unknown }).confirmDelivered !== true) {
    return Response.json(
      { error: "Confirm that the message arrived before recording it as delivered." },
      { status: 400 },
    );
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return Response.json(
      { error: "Message processing is not configured in this deployment" },
      { status: 503 },
    );
  }

  const outcome = await confirmDraftDelivered(service, user.id, messageId);
  if (outcome.ok) {
    return Response.json({ delivered: true, message: outcome.message }, { status: 200 });
  }

  const status =
    outcome.code === "not_found" || outcome.code === "not_draft"
      ? 404
      : outcome.code === "no_claim"
        ? 409
        : 403;

  return Response.json(
    { delivered: false, error: outcome.message, code: outcome.code },
    { status },
  );
}