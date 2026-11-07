import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStagingCalendarId } from "../calendar/googleCalendarGate.ts";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./googleCalendarStore.ts", import.meta.url), "utf8");

test("token store is server-only with actor membership checks scoped to owner/admin", () => {
  assert.match(source, /^import "server-only";/);
  assert.match(source, /\.in\("role", \["owner", "admin"\]\)/);
  assert.match(source, /from\(NAMES\.members\)/);
  assert.match(source, /from\(NAMES\.connections\)/);
});

test("token writes flow only through the service-role client", () => {
  assert.match(source, /saveGoogleCalendarConnection[\s\S]*service\s*\.from\(NAMES\.connections\)/);
  assert.match(source, /configureGoogleCalendarId[\s\S]*service\s*\.from\(NAMES\.connections\)/);
  assert.match(source, /disconnectGoogleCalendar[\s\S]*service\s*\.from\(NAMES\.connections\)/);
  assert.doesNotMatch(source, /createClient|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
});

test("the actor read path never selects or returns stored tokens", () => {
  assert.match(source, /"provider,calendar_id,scopes,token_expires_at,connected_at"/);
  assert.doesNotMatch(source, /readCalendarConnectionStatus[\s\S]*access_token_encrypted/);
  assert.doesNotMatch(source, /\.select\([^)]*refresh_token_encrypted/);
});

test("calendar id is never defaulted and never falls back to a primary calendar", () => {
  assert.doesNotMatch(source, /calendar_id[\s\S]*default|\bprimary\b/i);
  assert.match(source, /configureGoogleCalendarId[\s\S]*normalizeStagingCalendarId\(input.calendarId\)/);
  assert.match(source, /if \(!calendarId\) return \{ ok: false, error: "write_unavailable" \};/);
  const route = readFileSync(new URL("../../app/api/integrations/google-calendar/configure/route.ts", import.meta.url), "utf8");
  assert.match(route, /normalizeStagingCalendarId\(params.calendarId\)/);
  for (const invalid of ["primary", "PRIMARY", " primary ", "pr%69mary", "", "ab", "a".repeat(256), "test/calendar", "test calendar", "test\ncalendar"]) {
    assert.equal(normalizeStagingCalendarId(invalid), null, JSON.stringify(invalid));
  }
  const dedicated = "nexa-test@group.calendar.google.com";
  assert.equal(normalizeStagingCalendarId(" " + dedicated + " "), dedicated);
  assert.equal(normalizeStagingCalendarId("a".repeat(255)), "a".repeat(255));
});