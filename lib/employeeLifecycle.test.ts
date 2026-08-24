import assert from "node:assert/strict";
import test from "node:test";
import { allowedLifecycleTransitions, lifecyclePatch, validateLifecycleTransition } from "./employeeLifecycle.ts";

test("lifecycle transition map prevents unsafe jumps", () => {
  assert.deepEqual(allowedLifecycleTransitions("Draft"), ["Testing", "Archived"]);
  assert.equal(validateLifecycleTransition({ from: "Draft", to: "Active", activationReady: true }), "This lifecycle transition is not allowed.");
});

test("active transition requires a complete checklist", () => {
  assert.equal(validateLifecycleTransition({ from: "Testing", to: "Active", activationReady: false }), "Complete every activation requirement before going active.");
  assert.equal(validateLifecycleTransition({ from: "Testing", to: "Active", activationReady: true }), null);
});

test("every non-active state keeps the automation kill switch engaged", () => {
  assert.deepEqual(lifecyclePatch("Active"), { lifecycle_status: "Active", automation_paused: false });
  for (const status of ["Draft", "Testing", "Paused", "Archived"] as const) {
    assert.equal(lifecyclePatch(status).automation_paused, true);
  }
});
