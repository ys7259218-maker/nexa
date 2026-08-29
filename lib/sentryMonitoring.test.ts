import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getSafeSentryDsn,
  privacySafeSentryOptions,
} from "./sentryMonitoring.ts";

test("Sentry stays disabled for missing, placeholder, and unsafe DSNs", () => {
  assert.equal(getSafeSentryDsn(""), undefined);
  assert.equal(getSafeSentryDsn("your-sentry-dsn"), undefined);
  assert.equal(getSafeSentryDsn("http://public@example.com/1"), undefined);
  assert.equal(
    getSafeSentryDsn("https://public:secret@example.com/1"),
    undefined,
  );
  assert.equal(
    getSafeSentryDsn("https://public@example.com/not-a-project"),
    undefined,
  );
});

test("Sentry accepts a structurally valid public HTTPS DSN", () => {
  const dsn = "https://public@example.ingest.sentry.io/123";
  assert.equal(getSafeSentryDsn(dsn), dsn);
});

test("monitoring defaults exclude customer and business data", () => {
  assert.equal(privacySafeSentryOptions.sendDefaultPii, false);
  assert.equal(privacySafeSentryOptions.tracesSampleRate, 0);
  assert.deepEqual(privacySafeSentryOptions.dataCollection.httpBodies, []);
  assert.equal(privacySafeSentryOptions.dataCollection.cookies, false);
  assert.equal(privacySafeSentryOptions.dataCollection.urlQueryParams, false);
  assert.deepEqual(privacySafeSentryOptions.dataCollection.genAI, {
    inputs: false,
    outputs: false,
  });
});

test("build keeps source-map upload and Sentry telemetry disabled", () => {
  const config = readFileSync(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(config, /sourcemaps:\s*\{\s*disable:\s*true\s*\}/);
  assert.match(config, /telemetry:\s*false/);
});
