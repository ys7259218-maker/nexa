import assert from "node:assert/strict";
import test from "node:test";

import nextConfig, { SECURITY_HEADERS } from "../next.config.ts";

test("global security headers cover clickjacking, MIME, transport, and privacy controls", () => {
  const headers = new Map(SECURITY_HEADERS.map((header) => [header.key, header.value]));

  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.match(headers.get("Content-Security-Policy") ?? "", /object-src 'none'/);
  assert.match(headers.get("Strict-Transport-Security") ?? "", /max-age=63072000/);
  assert.match(headers.get("Permissions-Policy") ?? "", /camera=\(\)/);
});

test("Next.js applies global headers and disables API caching", async () => {
  assert.ok(nextConfig.headers);
  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === "/:path*");
  const apiRule = rules.find((rule) => rule.source === "/api/:path*");

  assert.equal(globalRule?.headers.length, SECURITY_HEADERS.length);
  assert.deepEqual(apiRule?.headers, [{ key: "Cache-Control", value: "no-store" }]);
});

