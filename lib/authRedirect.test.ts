import assert from "node:assert/strict";
import test from "node:test";

import { getSafeRecoveryDestination } from "./authRedirect.ts";

test("recovery redirects allow only the fixed reset-password route", () => {
  assert.equal(getSafeRecoveryDestination("/reset-password"), "/reset-password");
  assert.equal(getSafeRecoveryDestination("https://attacker.example"), "/reset-password");
  assert.equal(getSafeRecoveryDestination("//attacker.example"), "/reset-password");
  assert.equal(getSafeRecoveryDestination(null), "/reset-password");
});
