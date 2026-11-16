import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionPolicy,
  evaluateNavigation,
  evaluateRedirectChain,
  isPrivateOrReservedAddress,
  parseAllowListEntry,
} from "./sessionPolicy.ts";
import { createMockDriver } from "./mockDriver.ts";
import { createInMemoryEvidenceStore } from "./evidence.ts";
import { createApprovalGate } from "./approvalGate.ts";
import { createBrowserService } from "./browserService.ts";

const ALLOWED_HOST = "https://example.com/form";

function policy(
  allowList: readonly string[],
  options: Readonly<{
    allowedPorts?: readonly number[];
    resolver?: ((host: string) => readonly string[]) | null;
  }> = {},
) {
  return createSessionPolicy({
    workspaceId: "ws-1",
    allowList,
    allowedPorts: options.allowedPorts,
    resolver: options.resolver ?? null,
  });
}

test("SP-01 empty allow-list denies every navigation before any driver call", async () => {
  const decision = await evaluateNavigation(policy([]), ALLOWED_HOST);
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, "empty_allow_list");

  const driver = createMockDriver();
  const service = createBrowserService({
    driver,
    policy: policy([]),
    evidenceStore: createInMemoryEvidenceStore(),
    approvalGate: createApprovalGate({ resolver: () => "denied" }),
    clock: () => new Date("2026-11-16T10:00:00Z"),
  });
  const opened = await service.openSession({ workspaceId: "ws-1", taskId: "task-1" });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const inspected = await service.inspect(opened.value.sessionId, {
    targetUrl: ALLOWED_HOST,
  });
  assert.equal(inspected.ok, false);
  if (!inspected.ok) assert.equal(inspected.reason, "empty_allow_list");
  assert.deepEqual(driver.calls, []);
});

test("SP-02 an exact host on the tenant allow-list is allowed", async () => {
  const decision = await evaluateNavigation(policy(["example.com"]), ALLOWED_HOST);
  assert.equal(decision.allowed, true);
  if (!decision.allowed) return;
  assert.equal(decision.host, "example.com");
  assert.equal(decision.matchedEntry, "example.com");
  assert.equal(decision.scheme, "https");
});

test("SP-03 a sibling subdomain never inherits its parent; a wildcard is explicit", async () => {
  const sibling = await evaluateNavigation(
    policy(["example.com"]),
    "https://evil.example.com/",
  );
  assert.equal(sibling.allowed, false);
  if (!sibling.allowed) assert.equal(sibling.reason, "host_not_allowed");

  const wildcard = await evaluateNavigation(
    policy(["*.example.com"]),
    "https://app.example.com/",
  );
  assert.equal(wildcard.allowed, true);
  if (!wildcard.allowed) return;
  assert.equal(wildcard.matchedEntry, "*.example.com");

  const apex = await evaluateNavigation(
    policy(["*.example.com"]),
    "https://example.com/",
  );
  assert.equal(apex.allowed, false);
});

test("SP-04 Cyrillic/Greek look-alike hosts are denied after punycode normalisation", async () => {
  // U+0430 CYRILLIC SMALL LETTER A, not ASCII "a".
  const decision = await evaluateNavigation(
    policy(["apple.com"]),
    "https://\u0430pple.com/",
  );
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, "host_not_allowed");
  assert.match(decision.detail, /xn--pple-43d\.com/);
});

test("SP-05 javascript, data, file and blob URLs are denied", async () => {
  const subject = policy(["example.com"]);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<p>hi</p>",
    "file:///etc/passwd",
    "blob:https://example.com/1234",
  ]) {
    const decision = await evaluateNavigation(subject, url);
    assert.equal(decision.allowed, false, url);
    if (!decision.allowed) assert.equal(decision.reason, "scheme_not_allowed", url);
  }
});

test("SP-06 a redirect hop to an unlisted host is denied before render", async () => {
  const decision = await evaluateRedirectChain(policy(["example.com"]), [
    "https://example.com/start",
    "https://evil.example.net/landing",
  ]);
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, "redirect_off_list");
  assert.equal(decision.url, "https://evil.example.net/landing");

  const clean = await evaluateRedirectChain(policy(["example.com"]), [
    "https://example.com/start",
    "https://example.com/next",
  ]);
  assert.equal(clean.allowed, true);
});

test("SP-07 IP literals and private resolutions are denied before navigation", async () => {
  for (const url of [
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
  ]) {
    const decision = await evaluateNavigation(policy(["example.com"]), url);
    assert.equal(decision.allowed, false, url);
    if (!decision.allowed) assert.equal(decision.reason, "ip_literal", url);
  }

  for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.5", "169.254.169.254", "::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateOrReservedAddress(address), true, address);
  }

  const rebound = await evaluateNavigation(
    policy(["example.com"], { resolver: () => ["93.184.216.34", "127.0.0.1"] }),
    "https://example.com/",
  );
  assert.equal(rebound.allowed, false);
  if (!rebound.allowed) assert.equal(rebound.reason, "private_address");

  const resolverError = await evaluateNavigation(
    policy(["example.com"], {
      resolver: () => {
        throw new Error("dns down");
      },
    }),
    "https://example.com/",
  );
  assert.equal(resolverError.allowed, false);
  if (!resolverError.allowed) assert.equal(resolverError.reason, "resolver_error");
});

test("SP-08 ports outside the reviewed set are denied", async () => {
  const denied = await evaluateNavigation(
    policy(["example.com"]),
    "https://example.com:8443/",
  );
  assert.equal(denied.allowed, false);
  if (!denied.allowed) assert.equal(denied.reason, "port_not_allowed");

  const allowed = await evaluateNavigation(
    policy(["example.com"], { allowedPorts: [8443] }),
    "https://example.com:8443/",
  );
  assert.equal(allowed.allowed, true);
});

test("SP-09 embedded credentials are denied in a URL and dropped from allow-list entries", async () => {
  const decision = await evaluateNavigation(
    policy(["example.com"]),
    "https://user:pass@example.com/",
  );
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, "credentials_in_url");

  assert.equal(parseAllowListEntry("https://user:pass@example.com"), null);
  assert.equal(parseAllowListEntry("example.com:443"), null);
  assert.equal(parseAllowListEntry("  "), null);
});
