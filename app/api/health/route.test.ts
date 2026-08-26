import assert from "node:assert/strict";
import test from "node:test";

import { GET, HEAD } from "./route.ts";

test("GET reports only shallow application readiness", async () => {
  const response = GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(await response.json(), { status: "ready" });
});

test("GET does not expose deployment or provider details", async () => {
  const body = await GET().json();

  assert.deepEqual(Object.keys(body), ["status"]);
});

test("HEAD supports lightweight monitors without a response body", async () => {
  const response = HEAD();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(await response.text(), "");
});
