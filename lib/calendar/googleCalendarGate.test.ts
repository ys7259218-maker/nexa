import assert from "node:assert/strict";
import test from "node:test";
import { canEnableGoogleCalendar } from "./googleCalendarGate.ts";

const STAGING_URL = "https://vbizuxxgjlwqotuegskq.supabase.co";

function env(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    GOOGLE_CALENDAR_STAGING_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: STAGING_URL,
    VERCEL_ENV: "preview",
    ...overrides,
  };
}

test("enabled only when the flag is true, not production, and pinned to the staging ref", () => {
  assert.equal(canEnableGoogleCalendar(env()), true);
  assert.equal(canEnableGoogleCalendar(env({ VERCEL_ENV: "production" })), false);
  assert.equal(canEnableGoogleCalendar(env({ GOOGLE_CALENDAR_STAGING_ENABLED: "false" })), false);
  assert.equal(canEnableGoogleCalendar(env({ GOOGLE_CALENDAR_STAGING_ENABLED: undefined })), false);
  assert.equal(canEnableGoogleCalendar(env({ NEXT_PUBLIC_SUPABASE_URL: "https://other-project.supabase.co" })), false);
});

function prodEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    GOOGLE_CALENDAR_PRODUCTION_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://prod-ref.supabase.co",
    VERCEL_ENV: "production",
    ...overrides,
  };
}

test("production requires the explicit production flag and a non-staging Supabase URL", () => {
  assert.equal(canEnableGoogleCalendar(prodEnv()), true);
  assert.equal(canEnableGoogleCalendar(prodEnv({ GOOGLE_CALENDAR_PRODUCTION_ENABLED: "false" })), false);
  assert.equal(canEnableGoogleCalendar(prodEnv({ GOOGLE_CALENDAR_PRODUCTION_ENABLED: undefined })), false);
  assert.equal(canEnableGoogleCalendar(prodEnv({ NEXT_PUBLIC_SUPABASE_URL: STAGING_URL })), false);
  assert.equal(canEnableGoogleCalendar(prodEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined })), false);
  assert.equal(canEnableGoogleCalendar(prodEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url" })), false);
  assert.equal(canEnableGoogleCalendar(prodEnv({ NEXT_PUBLIC_SUPABASE_URL: STAGING_URL + "?x=1" })), false);
});

test("production malformed URLs are rejected even with the flag", () => {
  assert.equal(canEnableGoogleCalendar(prodEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://prod-ref.supabase.co" })), false);
  assert.equal(canEnableGoogleCalendar(prodEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://user:pass@prod-ref.supabase.co" })), false);
});

test("staging ref must be an exact https URL with no query, hash, port, or credentials", () => {
  assert.equal(canEnableGoogleCalendar(env({ NEXT_PUBLIC_SUPABASE_URL: STAGING_URL + "?x=1" })), false);
  assert.equal(canEnableGoogleCalendar(env({ NEXT_PUBLIC_SUPABASE_URL: STAGING_URL + ":8443" })), false);
  assert.equal(canEnableGoogleCalendar(env({ NEXT_PUBLIC_SUPABASE_URL: "https://user:pass@" + STAGING_URL })), false);
  assert.equal(canEnableGoogleCalendar(env({ NEXT_PUBLIC_SUPABASE_URL: "http://" + STAGING_URL })), false);
  assert.equal(canEnableGoogleCalendar(env({ NEXT_PUBLIC_SUPABASE_URL: "not a url" })), false);
});

test("a local/dev branch (no VERCEL_ENV) can be enabled once pinned to staging", () => {
  assert.equal(canEnableGoogleCalendar(env({ VERCEL_ENV: undefined })), true);
});