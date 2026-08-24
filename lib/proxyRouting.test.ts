import assert from "node:assert/strict";
import test from "node:test";

import {
  isAuthRoute,
  isProtectedPath,
  resolveProxyRedirect,
} from "./proxyRouting.ts";

test("treats protected prefixes and their children as protected", () => {
  assert.equal(isProtectedPath("/dashboard"), true);
  assert.equal(isProtectedPath("/dashboard/ai-employees/new"), true);
  assert.equal(isProtectedPath("/ai-employees"), true);
  assert.equal(isProtectedPath("/ai-employees/abc-123"), true);
  assert.equal(isProtectedPath("/conversations"), true);
  assert.equal(isProtectedPath("/conversations/abc-123"), true);
});

test("does not over-match similar paths", () => {
  assert.equal(isProtectedPath("/dashboards"), false);
  assert.equal(isProtectedPath("/ai-employees-archive"), false);
  assert.equal(isProtectedPath("/"), false);
  assert.equal(isProtectedPath("/login"), false);
});

test("flags only exact auth routes", () => {
  assert.equal(isAuthRoute("/login"), true);
  assert.equal(isAuthRoute("/signup"), true);
  assert.equal(isAuthRoute("/signup/extra"), false);
  assert.equal(isAuthRoute("/dashboard"), false);
});

test("redirects unauthenticated users from protected paths to /login", () => {
  assert.equal(resolveProxyRedirect("/dashboard", false), "/login");
  assert.equal(
    resolveProxyRedirect("/dashboard/ai-employees/new", false),
    "/login",
  );
  assert.equal(resolveProxyRedirect("/ai-employees/x", false), "/login");
  assert.equal(resolveProxyRedirect("/conversations", false), "/login");
});

test("lets unauthenticated users reach auth and public routes", () => {
  assert.equal(resolveProxyRedirect("/login", false), null);
  assert.equal(resolveProxyRedirect("/signup", false), null);
  assert.equal(resolveProxyRedirect("/", false), null);
});

test("redirects authenticated users away from auth routes to /dashboard", () => {
  assert.equal(resolveProxyRedirect("/login", true), "/dashboard");
  assert.equal(resolveProxyRedirect("/signup", true), "/dashboard");
});

test("keeps authenticated users on protected and public routes", () => {
  assert.equal(resolveProxyRedirect("/dashboard", true), null);
  assert.equal(resolveProxyRedirect("/ai-employees/abc", true), null);
  assert.equal(resolveProxyRedirect("/conversations", true), null);
  assert.equal(resolveProxyRedirect("/", true), null);
});
