import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createAIEmployee,
  deleteAIEmployee,
  getAIEmployee,
  listAIEmployees,
  updateAIEmployee,
} from "../../lib/aiEmployees.ts";
import { listWhatsAppChannels, saveWhatsAppChannel } from "../../lib/whatsappChannels.ts";
import { createKnowledgeEntry } from "../../lib/knowledgeEntries.ts";
import { createKnowledgeSource, deleteKnowledgeSource, markKnowledgeSourceReviewed } from "../../lib/knowledgeSources.ts";

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
const secondEmail = process.env.INTEGRATION_TEST_EMAIL_B;
const secondPassword = process.env.INTEGRATION_TEST_PASSWORD_B;

const configured = Boolean(url && anonKey && email && password);
const twoAccountsConfigured = configured && Boolean(secondEmail && secondPassword);

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
  let employeeId: string;

  before(async () => {
    client = createClient(url!, anonKey!);

    const { error } = await client.auth.signInWithPassword({
      email: email!,
      password: password!,
    });

    assert.equal(error, null, "test account sign-in failed");
  });

  after(async () => {
    if (channelId) await client.from("whatsapp_channels").delete().eq("id", channelId);
    if (employeeId) await client.from("ai_employees").delete().eq("id", employeeId);
  });

  it("lets the owner link, assign, and read WhatsApp channels", async () => {
    const employee = await createAIEmployee(client, {
      name: "WhatsApp Integration Employee",
      business_name: "WhatsApp Integration Business",
    });
    assert.equal(employee.error, null);
    assert.ok(employee.data);
    employeeId = employee.data.id;

    const save = await saveWhatsAppChannel(client, {
      phoneNumberId: `integration-${Date.now()}`,
      displayName: "Integration Channel",
      employeeId,
    });

    assert.equal(save.error, null);
    assert.ok(save.data);
    channelId = save.data.id;

    const list = await listWhatsAppChannels(client, 10, true);
    assert.equal(list.error, null);
    assert.ok(
      list.data.some(
        (channel) => channel.id === channelId && channel.ai_employee_id === employeeId,
      ),
    );
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
    channelId = "";

    const employeeRemoved = await deleteAIEmployee(client, employeeId);
    assert.equal(employeeRemoved.error, null);
    employeeId = "";
  });
});

describe("Phase 1 lifecycle, safety, and audit guards", { skip: !configured }, () => {
  let client: SupabaseClient;
  let employeeId = "";

  before(async () => {
    client = createClient(url!, anonKey!);
    const { error } = await client.auth.signInWithPassword({ email: email!, password: password! });
    assert.equal(error, null, "test account sign-in failed");
  });

  after(async () => {
    if (employeeId) await client.from("ai_employees").delete().eq("id", employeeId);
  });

  it("rejects an unsafe Active insert", async () => {
    const attempt = await client
      .from("ai_employees")
      .insert({
        name: "Unsafe Integration Insert",
        business_name: "Must Be Rejected",
        lifecycle_status: "Active",
        automation_paused: false,
      })
      .select("id");

    assert.ok(attempt.error, "direct Active insert must be rejected by the database guard");
  });

  it("allows an approved transition but rejects a direct lifecycle update", async () => {
    const created = await createAIEmployee(client, {
      name: "Lifecycle Integration Employee",
      business_name: "Lifecycle Integration Business",
    });
    assert.equal(created.error, null);
    assert.ok(created.data);
    employeeId = created.data.id;

    const approved = await client.rpc("transition_ai_employee_lifecycle", {
      target_employee_id: employeeId,
      target_status: "Testing",
    });
    assert.equal(approved.error, null, "owner transition RPC should be allowed");

    const bypass = await client
      .from("ai_employees")
      .update({ lifecycle_status: "Active", automation_paused: false })
      .eq("id", employeeId)
      .select("id");
    assert.ok(bypass.error, "direct lifecycle update must be rejected by the database guard");
  });

  it("keeps audit rows client-immutable", async () => {
    const history = await client
      .from("audit_events")
      .select("id,action")
      .eq("entity_id", employeeId)
      .limit(1)
      .maybeSingle();
    assert.equal(history.error, null);
    assert.ok(history.data?.id, "approved lifecycle transition should create an audit row");

    const changed = await client
      .from("audit_events")
      .update({ action: "forged" })
      .eq("id", history.data!.id)
      .select("id");
    assert.ok(changed.error || (changed.data ?? []).length === 0, "client must not update audit rows");

    const removed = await client
      .from("audit_events")
      .delete()
      .eq("id", history.data!.id)
      .select("id");
    assert.ok(removed.error || (removed.data ?? []).length === 0, "client must not delete audit rows");
  });

  it("captures immutable settings history and restores only through the guarded RPC", async () => {
    const changed = await updateAIEmployee(client, employeeId, {
      greeting_message: "Versioned integration greeting",
    });
    assert.equal(changed.error, null);

    const history = await client
      .from("ai_employee_versions")
      .select("id,snapshot")
      .eq("ai_employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    assert.equal(history.error, null);
    assert.ok(history.data?.id, "settings update should create an immutable snapshot");

    const forged = await client
      .from("ai_employee_versions")
      .update({ change_source: "restore" })
      .eq("id", history.data!.id)
      .select("id");
    assert.ok(forged.error || (forged.data ?? []).length === 0, "client must not edit version rows");

    const restored = await client.rpc("restore_ai_employee_version", {
      target_employee_id: employeeId,
      target_version_id: history.data!.id,
    });
    assert.equal(restored.error, null, "Owner restore RPC should be allowed");

    const employee = await getAIEmployee(client, employeeId);
    assert.equal(employee.error, null);
    assert.equal(employee.data?.greeting_message, "");
  });

  it("uses the guarded workspace safety RPC", async () => {
    const membership = await client
      .from("workspace_members")
      .select("workspace_id,role")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    assert.equal(membership.error, null);
    assert.ok(membership.data?.workspace_id);
    assert.ok(["owner", "admin"].includes(membership.data!.role));

    const paused = await client.rpc("set_workspace_automation_paused", {
      target_workspace_id: membership.data!.workspace_id,
      paused: true,
    });
    assert.equal(paused.error, null, "Owner/Admin safety RPC should be allowed");
  });
});

describe("two-account workspace isolation", { skip: !twoAccountsConfigured }, () => {
  let ownerClient: SupabaseClient;
  let outsiderClient: SupabaseClient;
  let employeeId = "";

  before(async () => {
    ownerClient = createClient(url!, anonKey!);
    outsiderClient = createClient(url!, anonKey!);
    const [ownerAuth, outsiderAuth] = await Promise.all([
      ownerClient.auth.signInWithPassword({ email: email!, password: password! }),
      outsiderClient.auth.signInWithPassword({ email: secondEmail!, password: secondPassword! }),
    ]);
    assert.equal(ownerAuth.error, null, "owner test account sign-in failed");
    assert.equal(outsiderAuth.error, null, "second test account sign-in failed");
  });

  after(async () => {
    if (employeeId) await ownerClient.from("ai_employees").delete().eq("id", employeeId);
  });

  it("prevents a different workspace from reading or changing an employee", async () => {
    const created = await createAIEmployee(ownerClient, {
      name: "Tenant Isolation Employee",
      business_name: "Tenant Isolation Business",
    });
    assert.equal(created.error, null);
    assert.ok(created.data);
    employeeId = created.data.id;

    const versioned = await updateAIEmployee(ownerClient, employeeId, {
      greeting_message: "Owner-only version",
    });
    assert.equal(versioned.error, null);

    const read = await outsiderClient.from("ai_employees").select("id").eq("id", employeeId);
    assert.equal(read.error, null);
    assert.deepEqual(read.data ?? [], []);

    const changed = await outsiderClient
      .from("ai_employees")
      .update({ name: "Cross-tenant change" })
      .eq("id", employeeId)
      .select("id");
    assert.ok(changed.error || (changed.data ?? []).length === 0);

    const removed = await outsiderClient.from("ai_employees").delete().eq("id", employeeId).select("id");
    assert.ok(removed.error || (removed.data ?? []).length === 0);

    const ownerHistory = await ownerClient
      .from("ai_employee_versions")
      .select("id")
      .eq("ai_employee_id", employeeId)
      .limit(1)
      .maybeSingle();
    assert.equal(ownerHistory.error, null);
    assert.ok(ownerHistory.data?.id);

    const outsiderHistory = await outsiderClient
      .from("ai_employee_versions")
      .select("id")
      .eq("ai_employee_id", employeeId);
    assert.equal(outsiderHistory.error, null);
    assert.deepEqual(outsiderHistory.data ?? [], []);

    const outsiderRestore = await outsiderClient.rpc("restore_ai_employee_version", {
      target_employee_id: employeeId,
      target_version_id: ownerHistory.data!.id,
    });
    assert.ok(outsiderRestore.error, "a different workspace must not restore an employee version");

    const ownerKnowledge = await createKnowledgeEntry(ownerClient, employeeId, {
      kind: "faq",
      title: "Private opening hours",
      question: "When are you open?",
      content: "Weekdays only.",
      verified: true,
    });
    assert.equal(ownerKnowledge.error, null);
    assert.ok(ownerKnowledge.data?.id);

    const outsiderKnowledge = await outsiderClient
      .from("knowledge_entries")
      .select("id")
      .eq("ai_employee_id", employeeId);
    assert.equal(outsiderKnowledge.error, null);
    assert.deepEqual(outsiderKnowledge.data ?? [], []);

    const forgedKnowledge = await outsiderClient
      .from("knowledge_entries")
      .insert({
        ai_employee_id: employeeId,
        kind: "note",
        title: "Forged",
        content: "Must be rejected",
        verified: true,
      })
      .select("id");
    assert.ok(forgedKnowledge.error, "a different workspace must not add employee knowledge");

    const changedKnowledge = await outsiderClient
      .from("knowledge_entries")
      .update({ content: "Cross-workspace edit" })
      .eq("id", ownerKnowledge.data!.id)
      .select("id");
    assert.ok(changedKnowledge.error || (changedKnowledge.data ?? []).length === 0);

    const ownerSource = await createKnowledgeSource(ownerClient, employeeId, {
      kind: "website",
      label: "Private source reference",
      websiteUrl: "https://docs.example.com/private-reference",
    });
    assert.equal(ownerSource.error, null);
    assert.ok(ownerSource.data?.id);

    const outsiderSources = await outsiderClient
      .from("knowledge_sources")
      .select("id")
      .eq("ai_employee_id", employeeId);
    assert.equal(outsiderSources.error, null);
    assert.deepEqual(outsiderSources.data ?? [], []);

    const forgedSource = await outsiderClient.rpc("create_knowledge_source", {
      target_employee_id: employeeId,
      source_kind: "website",
      source_label: "Forged",
      source_website_url: "https://example.com/forged",
      source_file_name: "",
      source_file_media_type: "",
      source_file_size_bytes: null,
    });
    assert.ok(forgedSource.error, "a different workspace must not add a source reference");

    const reviewed = await markKnowledgeSourceReviewed(
      ownerClient, employeeId, ownerSource.data!.id, 90,
    );
    assert.equal(reviewed.error, null, "Owner should record a manual metadata review");
    assert.ok(reviewed.data?.reviewed_at);

    const outsiderReview = await markKnowledgeSourceReviewed(
      outsiderClient, employeeId, ownerSource.data!.id, 90,
    );
    assert.ok(outsiderReview.error, "a different workspace must not record a review");

    const outsiderDelete = await deleteKnowledgeSource(
      outsiderClient, employeeId, ownerSource.data!.id,
    );
    assert.ok(outsiderDelete.error, "a different workspace must not delete a source");

    const deleted = await deleteKnowledgeSource(ownerClient, employeeId, ownerSource.data!.id);
    assert.equal(deleted.error, null);
    assert.equal(deleted.data?.knowledge_source_id, ownerSource.data!.id);

    const ownerReceipt = await ownerClient
      .from("knowledge_source_deletion_receipts")
      .select("id,knowledge_source_id,source_kind,deleted_at")
      .eq("knowledge_source_id", ownerSource.data!.id)
      .single();
    assert.equal(ownerReceipt.error, null);
    assert.equal(ownerReceipt.data?.source_kind, "website");

    const outsiderReceipts = await outsiderClient
      .from("knowledge_source_deletion_receipts")
      .select("id")
      .eq("knowledge_source_id", ownerSource.data!.id);
    assert.equal(outsiderReceipts.error, null);
    assert.deepEqual(outsiderReceipts.data ?? [], []);
  });
});
