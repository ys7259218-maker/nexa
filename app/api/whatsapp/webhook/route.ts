import { isValidWhatsAppSignature } from "@/lib/whatsapp";

export const runtime = "nodejs";

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

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!isValidWhatsAppSignature(rawBody, signature, appSecret)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  // Acknowledge verified events quickly. Durable processing is intentionally deferred
  // until the database schema and idempotency strategy are finalized.
  return Response.json({ received: true }, { status: 200 });
}
