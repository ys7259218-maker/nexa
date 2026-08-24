import { handleRetryRequest } from "@/lib/retryEndpoint";
import { retryPendingWebhookEvents } from "@/lib/server/whatsappProcessor";

export async function POST(request: Request): Promise<Response> {
  return handleRetryRequest(
    request,
    process.env.WHATSAPP_RETRY_SECRET,
    retryPendingWebhookEvents,
  );
}
