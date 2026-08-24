import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createAIEmployee,
  deleteAIEmployee,
  getAIEmployee,
  listAIEmployees,
  updateAIEmployee,
} from "../../lib/aiEmployees.ts";

/**
 * RLS integration scaffolding. Skipped unless a dedicated Supabase project
 * and test account are provided through environment variables — see
 * tests/integration/README.md. The anon key is the only credential used;
 * ownership isolation is expected to come from the policies in
 * docs/SUPABASE_SETUP.md.
 */
const url = process.env.INTEGRATION_SUPABASE_URL;
const anonKey = process.env.INTEGRATION_SUPABASE_ANON_KEY;
const email = process.env.INTEGRATION_TEST_EMAIL;
const password = process.env.INTEGRATION_TEST_PASSWORD;

const configured = Boolean(url && anonKey && email && password);

describe("ai_employees CRUD under RLS", { skip: !configured }, () => {
  let client: SupabaseClient;
  let employeeId: string;

  before(async () => {
    client = createClient(url!, anonKey!);

    const { error } = await client.auth.signInWithPassword({
      email: email!,
      password: password!,
    });

    assert.equal(error, null, "test account sign-in failed");
  });

  it("creates a record scoped to the signed-in owner", async () => {
    const result = await createAIEmployee(client, {
      name: "Integration Test Employee",
      business_name: "Integration Test Business",
    });

    assert.equal(result.error, null);
    assert.ok(result.data);
    assert.ok(result.data.user_id);
    employeeId = result.data.id;
  });

  it("reads and lists only owner records", async () => {
    const single = await getAIEmployee(client, employeeId);
    assert.equal(single.error, null);
    assert.equal(single.data?.name, "Integration Test Employee");

    const list = await listAIEmployees(client);
    assert.equal(list.error, null);
    assert.ok(list.data.some((item) => item.id === employeeId));
  });

  it("updates an owned record", async () => {
    const result = await updateAIEmployee(client, employeeId, {
      greeting_message: "Hello from integration tests",
    });

    assert.equal(result.error, null);
    assert.equal(result.data?.greeting_message, "Hello from integration tests");
  });

  it("deletes an owned record", async () => {
    const result = await deleteAIEmployee(client, employeeId);
    assert.equal(result.error, null);

    const gone = await getAIEmployee(client, employeeId);
    assert.equal(gone.error, null);
    assert.equal(gone.data, null);
  });
});
