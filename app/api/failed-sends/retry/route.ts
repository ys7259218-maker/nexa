import { getAuthenticatedUser } from "@/lib/auth";
import { isOutboundSendReady, parseOutboundConfig } from "@/lib/outbound/whatsappSender";
import { isValidMessageIdList, retryFailedSends } from "@/lib/retryFailedSends";
import { createSupabaseServiceClient } from "@/lib/server/whatsappProcessor";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawMessageIds = (body as { messageIds?: unknown }).messageIds;
  if (rawMessageIds !== undefined && !isValidMessageIdList(rawMessageIds)) {
    return Response.json({ error: "Invalid message ids" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return Response.json(
      { error: "Message processing is not configured in this deployment" },
      { status: 503 },
    );
  }

  const result = await retryFailedSends(
    service,
    user.id,
    isOutboundSendReady(parseOutboundConfig()),
    { messageIds: Array.isArray(rawMessageIds) ? rawMessageIds : undefined },
  );
  if (result.error !== null) {
    return Response.json({ error: "Could not load the failed-sends queue." }, { status: 500 });
  }

  const queued = result.results.filter((item) => item.queued).length;
  const skipped = result.results.length - queued;
  return Response.json({ ok: true, summary: { queued, skipped } });
}