import assert from "node:assert/strict";
import test from "node:test";

import { isValidInternalBearer } from "./internalAuth.ts";

const secret = "a-secure-retry-secret-that-is-longer-than-32-characters";

test("isValidInternalBearer accepts only the exact configured Bearer secret", () => {
  assert.equal(isValidInternalBearer(`Bearer ${secret}`, secret), true);
  assert.equal(isValidInternalBearer(`Bearer ${secret}x`, secret), false);
  assert.equal(isValidInternalBearer(secret, secret), false);
  assert.equal(isValidInternalBearer("Basic abc", secret), false);
});

test("isValidInternalBearer fails closed for missing and weak configuration", () => {
  assert.equal(isValidInternalBearer(`Bearer ${secret}`, undefined), false);
  assert.equal(isValidInternalBearer(`Bearer ${secret}`, "short"), false);
  assert.equal(isValidInternalBearer(null, secret), false);
  assert.equal(isValidInternalBearer("Bearer ", secret), false);
});

