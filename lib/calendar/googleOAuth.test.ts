import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import {
  buildGoogleAuthorizationUrl,
  decryptSecret,
  encryptSecret,
  exchangeGoogleAuthorizationCode,
  googleCalendarRedirectUri,
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_TOKEN_ENDPOINT,
  readGoogleCalendarConfig,
  s256Challenge,
  tokenKeyFromHex,
} from "./googleOAuth.ts";

const REDIRECT = "https://nexa-staging-preview.vercel.app/api/integrations/google-calendar/callback";
const KEY_HEX = "1".repeat(64);

test("token key is exactly 32 bytes from 64 hex chars", () => {
  assert.equal(tokenKeyFromHex(KEY_HEX).length, 32);
  assert.throws(() => tokenKeyFromHex("1".repeat(63)), /64 hexadecimal/);
  assert.throws(() => tokenKeyFromHex("z".repeat(64)), /64 hexadecimal/);
});

test("AES-256-GCM envelope round-trips and is non-deterministic", () => {
  const key = tokenKeyFromHex(KEY_HEX);
  const first = encryptSecret("top-secret", key);
  const second = encryptSecret("top-secret", key);
  assert.notEqual(first, second);
  assert.match(first, /^v1\./);
  assert.equal(decryptSecret(first, key), "top-secret");
  assert.throws(() => decryptSecret(first, tokenKeyFromHex("2".repeat(64))), /auth/i);
  assert.throws(() => decryptSecret("v0.aaaa.bbbb.cccc", key), /invalid/);
});

test("callback URI derives only from a bare https origin", () => {
  assert.equal(googleCalendarRedirectUri("https://nexa-staging-preview.vercel.app"), REDIRECT);
  assert.equal(googleCalendarRedirectUri("http://nexa-staging-preview.vercel.app"), null);
  assert.equal(googleCalendarRedirectUri("https://nexa-staging-preview.vercel.app/some/path"), null);
  assert.equal(googleCalendarRedirectUri("https://user:pass@nexa-staging-preview.vercel.app"), null);
  assert.equal(googleCalendarRedirectUri("not a url"), null);
});

test("PKCE challenge is base64url SHA-256 of the verifier", () => {
  assert.equal(s256Challenge("verifier"), createHash("sha256").update("verifier").digest("base64url"));
});

test("authorization URL uses the exact staging scope, offline access, and S256", () => {
  const url = buildGoogleAuthorizationUrl({
    clientId: "client-id",
    redirectUri: REDIRECT,
    state: "state-1",
    codeChallenge: s256Challenge("verifier"),
  });
  assert.equal(url.origin, new URL(GOOGLE_AUTH_ENDPOINT).origin);
  assert.equal(url.pathname, new URL(GOOGLE_AUTH_ENDPOINT).pathname);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), REDIRECT);
  assert.equal(url.searchParams.get("scope"), GOOGLE_CALENDAR_SCOPE);
  assert.equal(url.searchParams.get("state"), "state-1");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
});

test("token exchange posts code+verifier+secret and requires a refresh token", async () => {
  const exchange: typeof fetch = async (url, init) => {
    assert.equal(String(url), GOOGLE_TOKEN_ENDPOINT);
    const body = init?.body as string;
    assert.match(body, /code=the-code/);
    assert.match(body, /code_verifier=the-verifier/);
    assert.match(body, /client_secret=the-secret/);
    assert.match(body, /grant_type=authorization_code/);
    return new Response(
      JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3599, scope: GOOGLE_CALENDAR_SCOPE }),
      { status: 200 },
    );
  };
  const result = await exchangeGoogleAuthorizationCode({
    clientId: "cid",
    clientSecret: "the-secret",
    redirectUri: REDIRECT,
    code: "the-code",
    verifier: "the-verifier",
    fetchImpl: exchange,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.accessToken, "at");
    assert.equal(result.refreshToken, "rt");
    assert.equal(result.expiresInSeconds, 3599);
    assert.equal(result.scope, GOOGLE_CALENDAR_SCOPE);
  }
});

test("token exchange fails closed on non-200, missing refresh token, or network error", async () => {
  const nonOk: typeof fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
  const noRefresh: typeof fetch = async () =>
    new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
  const explodes: typeof fetch = async () => {
    throw new Error("boom");
  };
  const base = {
    clientId: "cid",
    clientSecret: "cs",
    redirectUri: REDIRECT,
    code: "code",
    verifier: "verifier",
  };
  assert.deepEqual(await exchangeGoogleAuthorizationCode({ ...base, fetchImpl: nonOk }), { ok: false, error: "invalid_response" });
  assert.deepEqual(await exchangeGoogleAuthorizationCode({ ...base, fetchImpl: noRefresh }), { ok: false, error: "invalid_response" });
  assert.deepEqual(await exchangeGoogleAuthorizationCode({ ...base, fetchImpl: explodes }), { ok: false, error: "network" });
});

test("server config fails closed unless client id, secret, and 64-hex key are all present", () => {
  const complete = {
    GOOGLE_CALENDAR_CLIENT_ID: "123-abc.apps.googleusercontent.com",
    GOOGLE_CALENDAR_CLIENT_SECRET: "GOCSPX-secret",
    GOOGLE_CALENDAR_TOKEN_KEY: KEY_HEX,
  };
  const config = readGoogleCalendarConfig(complete);
  assert.ok(config);
  if (config) {
    assert.equal(config.clientId, complete.GOOGLE_CALENDAR_CLIENT_ID);
    assert.equal(config.tokenKey.length, 32);
  }
  assert.equal(readGoogleCalendarConfig({ ...complete, GOOGLE_CALENDAR_CLIENT_SECRET: "" }), null);
  assert.equal(readGoogleCalendarConfig({ ...complete, GOOGLE_CALENDAR_CLIENT_ID: "   " }), null);
  assert.equal(readGoogleCalendarConfig({ ...complete, GOOGLE_CALENDAR_TOKEN_KEY: "1".repeat(60) }), null);
  assert.equal(readGoogleCalendarConfig({}), null);
});