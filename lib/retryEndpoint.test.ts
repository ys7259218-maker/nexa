import assert from "node:assert/strict";
import test from "node:test";

import { handleRetryRequest } from "./retryEndpoint.ts";

const secret = "retry-secret-with-at-least-thirty-two-characters";

function request(token?: string): Request {
  return new Request("https://nexa.example/api/internal/whatsapp/retry", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

test("handleRetryRequest fails closed before invoking retries", async () => {
  let calls = 0;
  const retry = async () => {
    calls += 1;
    return { accepted: 0, duplicates: 0, skipped: 0, failed: 0 };
  };

  assert.equal((await handleRetryRequest(request(secret), undefined, retry)).status, 503);
  assert.equal((await handleRetryRequest(request("wrong"), secret, retry)).status, 401);
  assert.equal(calls, 0);
});

test("handleRetryRequest runs a bounded batch and returns aggregate counts", async () => {
  let receivedLimit = 0;
  const response = await handleRetryRequest(request(secret), secret, async (limit) => {
    receivedLimit = limit;
    return { accepted: 2, duplicates: 0, skipped: 1, failed: 0 };
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(receivedLimit, 10);
  assert.deepEqual(await response.json(), {
    ok: true,
    summary: { accepted: 2, duplicates: 0, skipped: 1, failed: 0 },
  });
});

test("handleRetryRequest sanitizes processor failures", async () => {
  const response = await handleRetryRequest(request(secret), secret, async () => {
    throw new Error("sensitive database details");
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Retry service failed" });
});

