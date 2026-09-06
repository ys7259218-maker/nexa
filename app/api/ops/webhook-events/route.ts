import { requireAuthenticatedUser } from "@/lib/auth";
import { parseWebhookStatusFilter, listWebhookEvents, type WebhookEventStatusFilter } from "@/lib/webhookLedger";
import { createSupabaseServiceClient } from "@/lib/server/whatsappProcessor";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  void user;

  const url = new URL(request.url);
  const filter = parseWebhookStatusFilter(url.searchParams.get("status"));

  const result = await listWebhookEvents(createSupabaseServiceClient, filter);

  if (result.error) {
    return Response.json({ error: result.error }, { status: 503 });
  }

  return Response.json({ data: result.data, filter: filter satisfies WebhookEventStatusFilter });
}