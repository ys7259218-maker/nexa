/**
 * Phase B B6: Routing policy tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultPolicy,
  decideRoute,
  routeFor,
  modelCapabilitiesFor,
  defaultModelCapabilities,
  type TaskClass,
} from "./routingPolicy.ts";

test("defaultPolicy returns all four task classes", () => {
  const policy = defaultPolicy();
  assert.equal(policy.routes.size, 4);
  assert.ok(policy.routes.has("planning"));
  assert.ok(policy.routes.has("chat"));
  assert.ok(policy.routes.has("extraction"));
  assert.ok(policy.routes.has("embedding"));
});

test("routeFor returns the default route for unknown task class", () => {
  const policy = defaultPolicy();
  const route = routeFor(policy, "unknown" as TaskClass);
  assert.equal(route.taskClass, "chat");
  assert.equal(route.primary.provider, "mock");
});

test("decideRoute returns primary when enabled", () => {
  const policy = defaultPolicy();
  const decision = decideRoute(policy, "chat");
  assert.equal(decision.usedFallback, false);
  assert.equal(decision.reason, "primary");
  assert.equal(decision.route.primary.provider, "mock");
});

test("decideRoute falls back to mock when primary disabled", () => {
  const policy = defaultPolicy();
  const route = routeFor(policy, "chat");
  route.primary.enabled = false;
  const decision = decideRoute(policy, "chat");
  assert.equal(decision.usedFallback, true);
  assert.equal(decision.reason, "mock-fallback");
});

test("defaultModelCapabilities returns mock capabilities", () => {
  const caps = defaultModelCapabilities();
  assert.equal(caps.supportsToolCalls, false);
  assert.equal(caps.supportsStructuredOutput, false);
  assert.equal(caps.maxContextTokens, 4096);
});

test("modelCapabilitiesFor returns mock capabilities for mock route", () => {
  const policy = defaultPolicy();
  const route = routeFor(policy, "planning");
  const caps = modelCapabilitiesFor(route);
  assert.equal(caps.supportsToolCalls, false);
  assert.equal(caps.maxContextTokens, 4096);
});
