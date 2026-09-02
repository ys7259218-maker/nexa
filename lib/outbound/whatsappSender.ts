/**
 * Fail-closed Meta WhatsApp Cloud API outbound sender.
 *
 * This is the transport/policy layer that Phase 3 requires, but it is NOT wired
 * into any runtime path and can never send a real message on its own: every
 * send is gated by an explicit `enabled` flag plus a non-empty access token and
 * phone number id. It never logs message bodies, tokens, or phone numbers.
 *
 * Deferred to a separate, human-approved integration/migration step (still
 * behind the disabled flag):
 *   - persisting the returned wamid / `sent` status on the `messages` row
 *     (the `messages.status` check constraint does not yet allow `sent`),
 *   - enforcing the 24-hour session window against real inbound history,
 *   - template messages and database-driven rate/cost policy.
 */
import { isValidE164 } from "./validation.ts";

export const DEFAULT_GRAPH_VERSION = "v25.0";
export const DEFAULT_MAX_BODY_LENGTH = 4_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BACKOFF_MS = 200;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_MAX = 20;

export interface OutboundSenderConfig {
  enabled: boolean;
  accessToken: string;
  phoneNumberId: string;
  graphVersion: string;
  maxBodyLength: number;
  maxAttempts: number;
  backoffMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export interface RateLimiter {
  tryAcquire(key: string): boolean;
}

export type SendOutcome =
  | { kind: "not_ready" }
  | { kind: "invalid"; reason: string }
  | { kind: "rate_limited" }
  | { kind: "sent"; wamid: string }
  | { kind: "error" };

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Parse environment into a fail-closed outbound config. */
export function parseOutboundConfig(
  env: Record<string, string | undefined> = process.env,
): OutboundSenderConfig {
  const int = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    enabled: env.WHATSAPP_OUTBOUND_ENABLED === "true",
    accessToken: env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "",
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "",
    graphVersion: env.WHATSAPP_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
    maxBodyLength: int(env.OUTBOUND_MAX_BODY_LENGTH, DEFAULT_MAX_BODY_LENGTH),
    maxAttempts: int(env.OUTBOUND_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
    backoffMs: int(env.OUTBOUND_BACKOFF_MS, DEFAULT_BACKOFF_MS),
    rateLimitWindowMs: int(env.OUTBOUND_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    rateLimitMax: int(env.OUTBOUND_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
  };
}

/** The single source of truth for whether sending is permitted at all. */
export function isOutboundSendReady(config: OutboundSenderConfig): boolean {
  return config.enabled && config.accessToken.length > 0 && config.phoneNumberId.length > 0;
}

/** In-memory token bucket used to bound outbound throughput per phone number id. */
export function createRateLimiter(windowMs: number, max: number): RateLimiter {
  const state = new Map<string, { count: number; resetAt: number }>();

  return {
    tryAcquire(key: string): boolean {
      const now = Date.now();
      const current = state.get(key);
      if (!current || now >= current.resetAt) {
        state.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (current.count >= max) {
        return false;
      }
      current.count += 1;
      return true;
    },
  };
}

function endpoint(config: OutboundSenderConfig): string {
  return `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
}

export function isTransient(status: number, payload: unknown): boolean {
  if (status >= 500 && status <= 599) return true;
  if (status === 429) return true;
  const code = (payload as { error?: { code?: number } })?.error?.code;
  return code === 80007 || code === 131056;
}

export interface BuildTextParams {
  to: string;
  body: string;
  maxBodyLength: number;
}

export function buildTextPayload(params: BuildTextParams): {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  text: { preview_url: boolean; body: string };
} {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "text",
    text: { preview_url: false, body: params.body.slice(0, params.maxBodyLength) },
  };
}

export interface SendTextOptions {
  config: OutboundSenderConfig;
  to: string;
  body: string;
  fetchImpl?: FetchLike;
  rateLimiter?: RateLimiter;
  sleep?: (ms: number) => Promise<void>;
}

export async function sendTextMessage(options: SendTextOptions): Promise<SendOutcome> {
  const {
    config,
    to,
    body,
    fetchImpl = fetch,
    rateLimiter,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  if (!isOutboundSendReady(config)) {
    return { kind: "not_ready" };
  }

  if (!isValidE164(to)) {
    return { kind: "invalid", reason: "invalid_recipient" };
  }

  if (body.trim().length === 0) {
    return { kind: "invalid", reason: "empty_body" };
  }

  if (rateLimiter && !rateLimiter.tryAcquire(config.phoneNumberId)) {
    return { kind: "rate_limited" };
  }

  const payload = buildTextPayload({ to, body, maxBodyLength: config.maxBodyLength });

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await fetchImpl(endpoint(config), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      if (attempt < config.maxAttempts) {
        await sleep(config.backoffMs * attempt);
        continue;
      }
      return { kind: "error" };
    }

    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }

    if (response.ok && parsed != null && isSuccessfulSend(parsed)) {
      const wamid = extractWamid(parsed);
      if (!wamid) return { kind: "error" };
      return { kind: "sent", wamid };
    }

    if (!isTransient(response.status, parsed) || attempt >= config.maxAttempts) {
      return { kind: "error" };
    }

    await sleep(config.backoffMs * attempt);
  }

  return { kind: "error" };
}

function isSuccessfulSend(payload: unknown): boolean {
  if (payload == null || typeof payload !== "object") return false;
  const messages = (payload as { messages?: unknown[] }).messages;
  return Array.isArray(messages) && messages.length > 0;
}

function extractWamid(payload: unknown): string | null {
  const messages = (payload as { messages?: Array<{ id?: unknown }> }).messages;
  const id = Array.isArray(messages) ? messages[0]?.id : undefined;
  return typeof id === "string" && id.length > 0 ? id : null;
}
