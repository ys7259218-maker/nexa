export type InboundReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
};

export type InboundReadyState = {
  items: InboundReadinessItem[];
  ready: boolean;
};

/**
 * Secret-free readiness breakdown for the Meta WhatsApp inbound webhook.
 * Details never include the verify token, app secret, service-role key, or
 * Supabase URL; each presence is reported as a boolean only.
 */
export function describeInboundReadiness(
  env: Record<string, string | undefined> = process.env,
): InboundReadyState {
  const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  const items: InboundReadinessItem[] = [
    {
      key: "verify_token",
      label: "Webhook verify token",
      ready: verifyToken.length > 0,
      detail: verifyToken.length > 0
        ? "A verify token is configured for Meta's callback subscription."
        : "Set WHATSAPP_VERIFY_TOKEN so Meta can verify the webhook callback.",
    },
    {
      key: "app_secret",
      label: "WhatsApp app secret",
      ready: appSecret.length > 0,
      detail: appSecret.length > 0
        ? "The app secret is configured to validate x-hub-signature-256."
        : "Set WHATSAPP_APP_SECRET so inbound payloads are signature-checked.",
    },
    {
      key: "message_store",
      label: "Message store (Supabase)",
      ready: supabaseUrl.length > 0 && serviceRoleKey.length > 0,
      detail:
        supabaseUrl.length > 0 && serviceRoleKey.length > 0
          ? "A service-role connection is configured to persist inbound events."
          : "Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL so events can be stored.",
    },
  ];

  return { items, ready: items.every((item) => item.ready) };
}

export function isInboundReady(state: InboundReadyState): boolean {
  return state.ready === true;
}

export function describeInboundWebhookUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/whatsapp/webhook`;
}