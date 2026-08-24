import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getAIProvider } from "@/lib/server/aiProvider";
import {
  processWhatsAppEvents,
  retryFailedWebhookEvents,
  type IngestSummary,
} from "@/lib/whatsappIngest";
import { parseWhatsAppWebhookPayload } from "@/lib/whatsappEvents";

export function createSupabaseServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface WebhookIngestResult {
  configured: boolean;
  summary?: IngestSummary;
}

export async function ingestWhatsAppWebhook(rawBody: string): Promise<WebhookIngestResult> {
  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    return { configured: false };
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return { configured: true, summary: { accepted: 0, duplicates: 0, skipped: 0, failed: 1 } };
  }

  const events = parseWhatsAppWebhookPayload(parsedPayload);
  const summary = await processWhatsAppEvents(serviceClient, getAIProvider(), events);

  return { configured: true, summary };
}

export async function retryPendingWebhookEvents(limit = 10): Promise<IngestSummary> {
  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured; failed webhook events cannot be retried.",
    );
  }

  return retryFailedWebhookEvents(serviceClient, getAIProvider(), limit);
}
