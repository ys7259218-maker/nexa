import assert from "node:assert/strict";
import test from "node:test";

import { inspectDeployment, parseDeploymentBaseUrl } from "./deploymentSmoke.ts";

test("deployment URL must be a credential-free HTTPS origin", () => {
  assert.throws(() => parseDeploymentBaseUrl("http://example.com"));
  assert.throws(() => parseDeploymentBaseUrl("https://user:pass@example.com"));
  assert.throws(() => parseDeploymentBaseUrl("https://example.com?token=secret"));
  assert.throws(() => parseDeploymentBaseUrl("https://example.com/private"));
  assert.equal(parseDeploymentBaseUrl("https://example.com/").href, "https://example.com/");
});

test("deployment smoke accepts the exact public and auth contracts", async () => {
  let callsWithSignals = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    if (init?.signal) callsWithSignals += 1;
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname === "/") return new Response("ok", { status: 200 });
    if (url.pathname === "/api/health" && init?.method === "HEAD") {
      return new Response(null, { status: 200 });
    }
    if (url.pathname === "/api/health") {
      return new Response('{"status":"ready"}', {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
    return new Response(null, {
      status: 307,
      headers: { Location: "https://example.com/login" },
    });
  };

  assert.deepEqual(await inspectDeployment("https://example.com", fakeFetch), []);
  assert.equal(callsWithSignals, 4);
});

test("deployment smoke rejects an external login redirect", async () => {
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname === "/") return new Response("ok", { status: 200 });
    if (url.pathname === "/api/health" && init?.method === "HEAD") return new Response(null);
    if (url.pathname === "/api/health") {
      return new Response('{"status":"ready"}', {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return new Response(null, {
      status: 307,
      headers: { Location: "https://attacker.example/login" },
    });
  };

  const issues = await inspectDeployment("https://example.com", fakeFetch);
  assert.ok(issues.includes("Unauthenticated dashboard request did not redirect to /login."));
});

test("deployment smoke bounds and sanitizes timed-out requests", async () => {
  const privateError = "private upstream response";
  const fakeFetch: typeof fetch = async (_input, init) => {
    assert.ok(init?.signal);
    throw new DOMException(privateError, "AbortError");
  };

  const issues = await inspectDeployment("https://example.com", fakeFetch, 100);
  assert.equal(issues.length, 4);
  assert.equal(issues.join(" ").includes(privateError), false);
});

test("deployment smoke reports contract failures without response content", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    return new Response(url.pathname === "/api/health" ? "provider error details" : "bad", {
      status: 503,
    });
  };

  const issues = await inspectDeployment("https://example.com", fakeFetch);
  assert.ok(issues.length >= 4);
  assert.equal(issues.join(" ").includes("provider error details"), false);
});
