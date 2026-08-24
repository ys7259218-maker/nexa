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
import { listWhatsAppChannels, saveWhatsAppChannel } from "../../lib/whatsappChannels.ts";

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

describe("messaging tables under RLS", { skip: !configured }, () => {
  let client: SupabaseClient;
  let channelId: string;

  before(async () => {
    client = createClient(url!, anonKey!);

    const { error } = await client.auth.signInWithPassword({
      email: email!,
      password: password!,
    });

    assert.equal(error, null, "test account sign-in failed");
  });

  it("lets the owner link and read WhatsApp channels", async () => {
    const save = await saveWhatsAppChannel(client, {
      phoneNumberId: `integration-${Date.now()}`,
      displayName: "Integration Channel",
    });

    assert.equal(save.error, null);
    assert.ok(save.data);
    channelId = save.data.id;

    const list = await listWhatsAppChannels(client);
    assert.equal(list.error, null);
    assert.ok(list.data.some((channel) => channel.id === channelId));
  });

  it("cannot write conversations or messages from a client session", async () => {
    const conversationInsert = await client
      .from("conversations")
      .insert({ customer_wa_id: "15550000000" })
      .select("id");

    // No INSERT policy exists; writes must go through the server-only processor.
    assert.ok(
      conversationInsert.error,
      "conversations insert should be denied for authenticated clients",
    );

    const messageInsert = await client.from("messages").insert({}).select("id");

    assert.ok(messageInsert.error, "messages insert should be denied for authenticated clients");
  });

  it("cannot read the webhook event ledger at all", async () => {
    const ledger = await client.from("webhook_events").select("id").limit(1);

    // RLS is enabled with zero policies, so even SELECT returns nothing or an error.
    if (!ledger.error) {
      assert.deepEqual(ledger.data ?? [], []);
    }
  });

  it("cleans up the linked channel", async () => {
    const removed = await client.from("whatsapp_channels").delete().eq("id", channelId);

    assert.equal(removed.error, null);
  });
});
