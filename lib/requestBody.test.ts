import assert from "node:assert/strict";
import test from "node:test";

import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from "./requestBody.ts";

test("reads a request body within the byte limit", async () => {
  const request = new Request("https://nexa.test/webhook", {
    method: "POST",
    body: "hello Nexa",
  });

  assert.equal(await readRequestTextWithLimit(request, 64), "hello Nexa");
});

test("rejects an oversized declared content length before reading", async () => {
  const request = new Request("https://nexa.test/webhook", {
    method: "POST",
    headers: { "content-length": "1000" },
    body: "small",
  });

  await assert.rejects(
    readRequestTextWithLimit(request, 100),
    RequestBodyTooLargeError,
  );
});

test("enforces the real streamed byte count when content length is absent", async () => {
  const request = new Request("https://nexa.test/webhook", {
    method: "POST",
    body: "🙂🙂🙂",
  });

  await assert.rejects(
    readRequestTextWithLimit(request, 8),
    RequestBodyTooLargeError,
  );
});

test("rejects invalid limits", async () => {
  const request = new Request("https://nexa.test/webhook", {
    method: "POST",
    body: "hello",
  });

  await assert.rejects(readRequestTextWithLimit(request, 0), TypeError);
});
