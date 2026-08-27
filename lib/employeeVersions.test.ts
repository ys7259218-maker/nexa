import assert from "node:assert/strict";
import test from "node:test";

import {
  employeeVersionSourceLabel,
  isValidEmployeeVersionId,
  listEmployeeVersions,
  restoreEmployeeVersion,
} from "./employeeVersions.ts";

const employeeId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";

function listClient(result: { data: unknown[] | null; error: null | { message: string } }) {
  const calls: Array<[string, unknown]> = [];
  const builder = {
    select(value: string) {
      calls.push(["select", value]);
      return builder;
    },
    eq(field: string, value: unknown) {
      calls.push([`eq:${field}`, value]);
      return builder;
    },
    order(field: string, options: unknown) {
      calls.push([`order:${field}`, options]);
      return builder;
    },
    async limit(value: number) {
      calls.push(["limit", value]);
      return result;
    },
  };

  return {
    calls,
    client: { from: (table: string) => (calls.push(["from", table]), builder) } as never,
  };
}

test("employee version identifiers accept only bounded UUIDs", () => {
  assert.equal(isValidEmployeeVersionId(employeeId), true);
  assert.equal(isValidEmployeeVersionId("not-a-uuid"), false);
  assert.equal(isValidEmployeeVersionId("a".repeat(100)), false);
  assert.equal(isValidEmployeeVersionId(null), false);
});

test("version history is owner-scoped by employee and bounded", async () => {
  const row = {
    id: versionId,
    workspace_id: "33333333-3333-4333-8333-333333333333",
    ai_employee_id: employeeId,
    created_by: null,
    change_source: "migration_baseline",
    snapshot: { name: "Ava" },
    created_at: "2026-08-27T00:00:00.000Z",
  };
  const fake = listClient({ data: [row], error: null });

  assert.deepEqual(await listEmployeeVersions(fake.client, employeeId, 10), {
    data: [row],
    error: null,
  });
  assert.deepEqual(fake.calls.at(-1), ["limit", 10]);
  assert.ok(fake.calls.some(([name, value]) => name === "eq:ai_employee_id" && value === employeeId));
});

test("version history rejects invalid requests and sanitizes database errors", async () => {
  const fake = listClient({ data: null, error: { message: "private database detail" } });

  assert.deepEqual(await listEmployeeVersions(fake.client, employeeId), {
    data: [],
    error: "Could not load employee version history.",
  });
  assert.deepEqual(await listEmployeeVersions(fake.client, "bad", 100), {
    data: [],
    error: "Invalid employee version request.",
  });
});

test("restore uses only the guarded RPC and returns generic failures", async () => {
  const calls: unknown[] = [];
  const successClient = {
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args]);
      return { error: null };
    },
  } as never;

  assert.deepEqual(await restoreEmployeeVersion(successClient, employeeId, versionId), {
    error: null,
  });
  assert.deepEqual(calls, [["restore_ai_employee_version", {
    target_employee_id: employeeId,
    target_version_id: versionId,
  }]]);

  const failureClient = {
    rpc: async () => ({ error: { message: "private database detail" } }),
  } as never;
  assert.deepEqual(await restoreEmployeeVersion(failureClient, employeeId, versionId), {
    error: "Could not restore this employee version.",
  });
  assert.deepEqual(await restoreEmployeeVersion(failureClient, "bad", versionId), {
    error: "Invalid employee version restore request.",
  });
});

test("version source labels stay honest and specific", () => {
  assert.equal(employeeVersionSourceLabel("migration_baseline"), "Migration baseline");
  assert.equal(employeeVersionSourceLabel("settings_update"), "Settings snapshot");
  assert.equal(employeeVersionSourceLabel("restore"), "State saved before restore");
});
