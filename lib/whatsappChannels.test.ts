import assert from "node:assert/strict";
import test from "node:test";

import {
  assignWhatsAppChannel,
  listWhatsAppChannels,
  saveWhatsAppChannel,
} from "./whatsappChannels.ts";

const channelId = "11111111-1111-4111-8111-111111111111";
const employeeId = "22222222-2222-4222-8222-222222222222";

function fakeClient(finalResult: unknown) {
  const calls: Array<[string, unknown]> = [];
  const builder = {
    select(value: string) { calls.push(["select", value]); return builder; },
    order(field: string, options: unknown) { calls.push([`order:${field}`, options]); return builder; },
    limit: async (value: number) => (calls.push(["limit", value]), finalResult),
    upsert(value: unknown, options: unknown) { calls.push(["upsert", value]); calls.push(["upsertOptions", options]); return builder; },
    update(value: unknown) { calls.push(["update", value]); return builder; },
    eq(field: string, value: unknown) { calls.push([`eq:${field}`, value]); return builder; },
    single: async () => finalResult,
  };
  return {
    calls,
    client: { from: (table: string) => (calls.push(["from", table]), builder) } as never,
  };
}

test("channel reads opt into assignment only after the rollout migration", async () => {
  const legacy = fakeClient({ data: [{ id: channelId, phone_number_id: "123", display_name: "Main", created_at: "now" }], error: null });
  const legacyResult = await listWhatsAppChannels(legacy.client);
  assert.equal(legacyResult.data[0]?.ai_employee_id, null);
  assert.ok(legacy.calls.some(([name, value]) => name === "select" && !String(value).includes("ai_employee_id")));

  const assigned = fakeClient({ data: [{ id: channelId, phone_number_id: "123", display_name: "Main", ai_employee_id: employeeId, created_at: "now" }], error: null });
  const assignedResult = await listWhatsAppChannels(assigned.client, 10, true);
  assert.equal(assignedResult.data[0]?.ai_employee_id, employeeId);
  assert.ok(assigned.calls.some(([name, value]) => name === "select" && String(value).includes("ai_employee_id")));
});

test("channel save includes a validated employee assignment without accepting forged workspace identity", async () => {
  const row = { id: channelId, phone_number_id: "123", display_name: "Main", ai_employee_id: employeeId, created_at: "now" };
  const fake = fakeClient({ data: row, error: null });
  const result = await saveWhatsAppChannel(fake.client, { phoneNumberId: " 123 ", displayName: " Main ", employeeId });
  assert.deepEqual(result, { data: row, error: null });
  const payload = fake.calls.find(([name]) => name === "upsert")?.[1] as Record<string, unknown>;
  assert.deepEqual(payload, { phone_number_id: "123", display_name: "Main", ai_employee_id: employeeId });
  assert.equal("workspace_id" in payload, false);
  assert.equal("user_id" in payload, false);

  const invalid = await saveWhatsAppChannel(fake.client, { phoneNumberId: "123", displayName: "Main", employeeId: "bad" });
  assert.match(invalid.error ?? "", /valid AI Employee/);
});

test("channel reassignment is scoped to validated channel and employee ids", async () => {
  const row = { id: channelId, phone_number_id: "123", display_name: "Main", ai_employee_id: employeeId, created_at: "now" };
  const fake = fakeClient({ data: row, error: null });
  assert.deepEqual(await assignWhatsAppChannel(fake.client, channelId, employeeId), { data: row, error: null });
  assert.ok(fake.calls.some(([name, value]) => name === "update" && (value as { ai_employee_id?: string }).ai_employee_id === employeeId));
  assert.ok(fake.calls.some(([name, value]) => name === "eq:id" && value === channelId));
  assert.match((await assignWhatsAppChannel(fake.client, "bad", employeeId)).error ?? "", /Invalid/);
});
