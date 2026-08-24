import { isValidWhatsAppSignature } from "@/lib/whatsapp";
import { ingestWhatsAppWebhook } from "@/lib/server/whatsappProcessor";
import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/requestBody";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return Response.json({ error: "Webhook verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    return Response.json({ error: "WhatsApp webhook is not configured" }, { status: 503 });
  }

  let rawBody: string;

  try {
    rawBody = await readRequestTextWithLimit(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Webhook payload is too large" }, { status: 413 });
    }

    return Response.json({ error: "Unable to read webhook payload" }, { status: 400 });
  }

  const signature = request.headers.get("x-hub-signature-256");

  if (!isValidWhatsAppSignature(rawBody, signature, appSecret)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  // Durable, idempotent processing runs through the server-only processor
  // boundary. Valid signatures are always acknowledged with 200 so Meta does
  // not retry storms; failures are recorded on the webhook_events ledger for
  // replay instead.
  const result = await ingestWhatsAppWebhook(rawBody);

  return Response.json(
    {
      received: true,
      processing: result.configured ? result.summary : "unconfigured",
    },
    { status: 200 },
  );
}
