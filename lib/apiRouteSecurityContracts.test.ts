import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guardedJsonRoutes = [
  "app/api/failed-sends/retry/route.ts",
  "app/api/outbound/draft/route.ts",
] as const;

for (const routePath of guardedJsonRoutes) {
  test(`${routePath} enforces the actual streamed request-body limit`, () => {
    const source = readFileSync(routePath, "utf8");

    assert.match(
      source,
      /readRequestTextWithLimit\(request, MAX_BODY_BYTES\)/,
    );
    assert.match(source, /error instanceof RequestBodyTooLargeError/);
    assert.doesNotMatch(source, /await request\.json\(\)/);
    assert.doesNotMatch(source, /Number\(request\.headers\.get\("content-length"\)/);
  });
}
