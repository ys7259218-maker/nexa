import assert from "node:assert/strict";
import test from "node:test";
import { maskMemberId, updateTeamMemberRole } from "./teamMembers.ts";

test("member identifiers are masked", () => { assert.equal(maskMemberId("1234567890abcdef"), "1234…cdef"); });
test("role updates reject incomplete targets before querying", async () => {
  assert.deepEqual(await updateTeamMemberRole({} as never, "", "user", "admin"), { error: "Invalid role update." });
  assert.deepEqual(await updateTeamMemberRole({} as never, "workspace", "", "viewer"), { error: "Invalid role update." });
});
