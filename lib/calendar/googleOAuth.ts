import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Staging-only, least-privilege Google Calendar OAuth. Scope is restricted to
 * events created/owned by the connected account
 * (https://www.googleapis.com/auth/calendar.events.owned); this module never
 * reads calendar list metadata and never creates an event. All functions are
 * pure and network-free except where an injectable `fetchImpl` is required, so
 * the flow is fully unit-testable without any client secret.
 */

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";
export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const CALLBACK_PATH = "/api/integrations/google-calendar/callback";

export type OAuthState = Readonly<{
  state: string;
  verifier: string;
}>;

export function googleCalendarRedirectUri(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash ||
    !url.hostname
  ) {
    return null;
  }
  return `${url.origin}${CALLBACK_PATH}`;
}

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function createPkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): URL {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: GOOGLE_CALENDAR_SCOPE,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  }).toString();
  return url;
}

export type GoogleTokenExchangeResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresInSeconds: number;
      scope: string;
    }
  | { ok: false; error: "network" | "invalid_response" };

export async function exchangeGoogleAuthorizationCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  verifier: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleTokenExchangeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.verifier,
  });
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (!response.ok) return { ok: false, error: "invalid_response" };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "invalid_response" };
  }
  const token = payload as Record<string, unknown>;
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  const refreshToken = typeof token.refresh_token === "string" ? token.refresh_token : "";
  const expiresIn = Number(token.expires_in);
  const scope = typeof token.scope === "string" ? token.scope : "";
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, error: "invalid_response" };
  }
  return {
    ok: true,
    accessToken,
    refreshToken,
    expiresInSeconds: Math.floor(expiresIn),
    scope,
  };
}

const TOKEN_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

/** GOOGLE_CALENDAR_TOKEN_KEY is a 32-byte key as 64 hex chars. */
export function tokenKeyFromHex(hex: string): Buffer {
  if (!TOKEN_KEY_PATTERN.test(hex)) {
    throw new Error("GOOGLE_CALENDAR_TOKEN_KEY must be 64 hexadecimal characters");
  }
  return Buffer.from(hex, "hex");
}

/** AES-256-GCM envelope: `v1.<iv>.<tag>.<ciphertext>` (all base64url). */
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${[iv, tag, encrypted].map((part) => part.toString("base64url")).join(".")}`;
}

export function decryptSecret(payload: string, key: Buffer): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("invalid encrypted payload");
  const [iv, tag, data] = parts.slice(1).map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export type GoogleCalendarConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  tokenKey: Buffer;
}>;

/** Full, validated server config. Returns null so routes fail closed until the
 * operator supplies the OAuth client (never created by this repo) and key. */
export function readGoogleCalendarConfig(
  env: Readonly<Record<string, string | undefined>>,
): GoogleCalendarConfig | null {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ?? "";
  const tokenKeyHex = env.GOOGLE_CALENDAR_TOKEN_KEY?.trim() ?? "";
  if (!clientId || !clientSecret || !TOKEN_KEY_PATTERN.test(tokenKeyHex)) return null;
  return { clientId, clientSecret, tokenKey: Buffer.from(tokenKeyHex, "hex") };
}