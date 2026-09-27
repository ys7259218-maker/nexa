import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isSameOriginReviewRequest } from "./reviewOriginGuard.ts";

const target = "https://nexa-staging-preview.vercel.app/api/appointment-reviews";
function request(origin?: string, url = target): Request {
  return new Request(url, { method: "POST", headers: origin === undefined ? {} : { origin } });
}
test("same-origin HTTPS staging request is accepted", () => {
  assert.equal(isSameOriginReviewRequest(request("https://nexa-staging-preview.vercel.app")), true);
});
test("missing, null, other deployment, deceptive hostname, and malformed origin are refused", () => {
  for (const origin of [undefined, "null", "", "https://nexa.vercel.app",
    "https://nexa-staging-preview.vercel.app.attacker.example",
    "http://nexa-staging-preview.vercel.app", "garbage",
    "https://nexa-staging-preview.vercel.app?foo=1",
    "https://nexa-staging-preview.vercel.app/path",
    "https://user@nexa-staging-preview.vercel.app"]) {
    assert.equal(isSameOriginReviewRequest(request(origin)), false, String(origin));
  }
});
test("non-HTTPS target is rejected even if origin matches", () => {
  assert.equal(isSameOriginReviewRequest(request("http://localhost:3000", "http://localhost:3000/api/appointment-reviews")), false);
});
test("endpoint checks browser origin before reading authenticated session", () => {
  const route = readFileSync(new URL("../../app/api/appointment-reviews/route.ts", import.meta.url), "utf8");
  const originPosition = route.indexOf("isSameOriginReviewRequest(request)");
  const authPosition = route.indexOf("supabase.auth.getUser()");
  assert.ok(originPosition >= 0 && authPosition > originPosition);
  assert.match(route, /status: 403/);
});
