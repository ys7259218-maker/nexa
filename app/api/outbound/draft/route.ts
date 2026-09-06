import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/server/whatsappProcessor";
import {
  isValidDraftMessageId,
  isValidTemplateLanguage,
  isValidTemplateName,
  isValidTemplateParams,
  sendApprovedDraft,
} from "@/lib/server/draftSender";

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

  const messageId = (body as { messageId?: unknown }).messageId;
  if (!isValidDraftMessageId(messageId)) {
    return Response.json({ error: "Invalid message id" }, { status: 400 });
  }

  const rawTemplateName = (body as { templateName?: unknown }).templateName;
  const rawTemplateLanguage = (body as { templateLanguage?: unknown }).templateLanguage;
  const rawTemplateParams = (body as { templateParams?: unknown }).templateParams;
  const preferTemplate = (body as { preferTemplate?: unknown }).preferTemplate === true;
  if (rawTemplateName !== undefined && !isValidTemplateName(rawTemplateName)) {
    return Response.json({ error: "Invalid template name" }, { status: 400 });
  }
  if (rawTemplateLanguage !== undefined && !isValidTemplateLanguage(rawTemplateLanguage)) {
    return Response.json({ error: "Invalid template language" }, { status: 400 });
  }
  if (rawTemplateParams !== undefined && !isValidTemplateParams(rawTemplateParams)) {
    return Response.json({ error: "Invalid template params" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return Response.json(
      { error: "Message processing is not configured in this deployment" },
      { status: 503 },
    );
  }

  const outcome = await sendApprovedDraft(service, user.id, messageId, {
    templateName: typeof rawTemplateName === "string" ? rawTemplateName : undefined,
    templateLanguage:
      typeof rawTemplateLanguage === "string" ? rawTemplateLanguage : undefined,
    templateParams: Array.isArray(rawTemplateParams) ? rawTemplateParams : undefined,
    preferTemplate,
  });
  if (outcome.ok) {
    return Response.json({ sent: true, wamid: outcome.wamid }, { status: 200 });
  }

  const status =
    outcome.code === "not_ready" || outcome.code === "persist_failed"
      ? 503
      : outcome.code === "not_found" || outcome.code === "not_draft"
        ? 404
        : 403;

  return Response.json(
    { sent: false, error: outcome.message, code: outcome.code },
    { status },
  );
}