import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  processWhatsAppEvents,
  retryFailedWebhookEvents,
  shouldApplyDeliveryStatus,
} from "./whatsappIngest.ts";
import { MockAIProvider } from "./ai/mockProvider.ts";
import type { WhatsAppInboundEvent, WhatsAppStatusEvent } from "./whatsappEvents.ts";

process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED = "true";

type Row = Record<string, unknown>;

class FakeSupabase {
  counter = 0;
  tables: Record<string, Row[]> = {};
  updates: Array<{ table: string; patch: Row }> = [];
  failingInsertTables: string[] = [];
  enforceMessageUnique = false;

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }

  nextId(): string {
    this.counter += 1;
    return `gen-${this.counter}`;
  }
}

class FakeQueryBuilder {
  private table: string;
  private supabase: FakeSupabase;

  private pendingInsert: Row[] | null = null;
  private pendingUpdate: Row | null = null;
  private conflictColumn = "";
  private ignoreDuplicates = false;
  private wantsSelect = false;
  private selectColumns = "*";
  private singleMode: "none" | "single" | "maybe" = "none";
  private filters: Array<{ column: string; value: unknown }> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;

  constructor(supabase: FakeSupabase, table: string) {
    this.supabase = supabase;
    this.table = table;
  }

  select(columns?: string): FakeQueryBuilder {
    this.wantsSelect = true;
    this.selectColumns = columns ?? "*";
    return this;
  }

  insert(payload: Row | Row[]): FakeQueryBuilder {
    this.pendingInsert = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  upsert(
    payload: Row | Row[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): FakeQueryBuilder {
    this.pendingInsert = Array.isArray(payload) ? payload : [payload];
    this.conflictColumn = options?.onConflict ?? "";
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false;
    return this;
  }

  update(patch: Row): FakeQueryBuilder {
    this.pendingUpdate = patch;
    return this;
  }

  onConflict(column: string): FakeQueryBuilder {
    this.conflictColumn = column;
    return this;
  }

  ignore(): FakeQueryBuilder {
    this.ignoreDuplicates = true;
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): FakeQueryBuilder {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number): FakeQueryBuilder {
    this.limitCount = count;
    return this;
  }

  single(): FakeQueryBuilder {
    this.singleMode = "single";
    return this;
  }

  maybeSingle(): FakeQueryBuilder {
    this.singleMode = "maybe";
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => row[filter.column] === filter.value);
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const executor = (resolve: (value: unknown) => void): void => {
      resolve(this.execute());
    };

    return new Promise(executor).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: unknown } {
    if (this.pendingUpdate !== null) {
      const rows = this.supabase.tables[this.table] ?? [];

      for (const row of rows) {
        if (this.matches(row)) {
          Object.assign(row, this.pendingUpdate);
        }
      }

      this.supabase.updates.push({ table: this.table, patch: { ...this.pendingUpdate } });

      return { data: null, error: null };
    }

    if (this.pendingInsert !== null) {
      if (this.supabase.failingInsertTables.includes(this.table)) {
        return { data: null, error: { code: "P0000", message: `${this.table} insert failed` } };
      }

      if (
        this.table === "messages" &&
        this.supabase.enforceMessageUnique &&
        this.conflictColumn === ""
      ) {
        const existingIds = new Set(
          (this.supabase.tables["messages"] ?? [])
            .map((row) => row["wa_message_id"])
            .filter(Boolean),
        );

        const duplicate = this.pendingInsert.some((row) =>
          existingIds.has(row["wa_message_id"]),
        );

        if (duplicate) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          };
        }
      }

      const rows = this.supabase.tables[this.table] ?? [];
      const accepted: Row[] = [];

      for (const rawRow of this.pendingInsert) {
        const row: Row = { id: this.supabase.nextId(), ...rawRow };

        if (this.conflictColumn && this.ignoreDuplicates) {
          const conflictValue = row[this.conflictColumn];

          if (
            rows.some((existing) => existing[this.conflictColumn] === conflictValue) ||
            accepted.some((pending) => pending[this.conflictColumn] === conflictValue)
          ) {
            continue;
          }
        }

        accepted.push(row);
        rows.push(row);
      }

      this.supabase.tables[this.table] = rows;

      if (!this.wantsSelect) {
        return { data: null, error: null };
      }

      let data: unknown = accepted;

      if (this.singleMode === "single") {
        data = accepted[0] ?? null;

        if (accepted.length === 0) {
          return { data: null, error: { code: "PGRST116", message: "No rows found" } };
        }
      }

      if (this.singleMode === "maybe") {
        data = accepted[0] ?? null;
      }

      return { data, error: null };
    }

    let rows = [...(this.supabase.tables[this.table] ?? [])];

    rows = rows.filter((row) => this.matches(row));

    if (this.orderBy !== null) {
      const { column, ascending } = this.orderBy;

      rows.sort((a, b) => {
        const left = String(a[column] ?? "");
        const right = String(b[column] ?? "");

        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    let data: unknown = rows;

    if (this.singleMode === "single") {
      data = rows[0] ?? null;

      if (rows.length === 0) {
        return { data: null, error: { code: "PGRST116", message: "No rows found" } };
      }
    }

    if (this.singleMode === "maybe") {
      data = rows[0] ?? null;
    }

    return { data, error: null };
  }
}

function makeTextEvent(overrides: Partial<WhatsAppInboundEvent> = {}): WhatsAppInboundEvent {
  return {
    eventId: "wamid.test-1",
    phoneNumberId: "phone-123",
    fromWaId: "15557771234",
    profileName: "Test Customer",
    messageType: "text",
    body: "Do you have openings on Friday?",
    occurredAtIso: new Date("2026-08-24T10:00:00Z").toISOString(),
    ...overrides,
  };
}

function makeStatusEvent(overrides: Partial<WhatsAppStatusEvent> = {}): WhatsAppStatusEvent {
  return {
    eventKind: "status",
    eventId: "status:wamid.outbound-1:delivered",
    phoneNumberId: "phone-123",
    recipientWaId: "15557771234",
    messageId: "wamid.outbound-1",
    status: "delivered",
    occurredAtIso: "2026-08-24T10:05:00.000Z",
    ...overrides,
  };
}

function seedOwnerWorkspace(store: FakeSupabase): void {
  store.tables["workspaces"] = [{ id: "workspace-1", automation_paused: false }];
  store.tables["whatsapp_channels"] = [
    { id: "chan-1", user_id: "owner-1", workspace_id: "workspace-1", ai_employee_id: "emp-1", phone_number_id: "phone-123", display_name: "Main" },
  ];
  store.tables["ai_employees"] = [
    {
      id: "emp-1",
      user_id: "owner-1",
      workspace_id: "workspace-1",
      name: "Ava",
      business_name: "Bright Dental",
      greeting_message: "Welcome to Bright Dental!",
      knowledge_notes: "",
      status: "Active",
      lifecycle_status: "Active",
      automation_paused: false,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
}

const provider = new MockAIProvider();

function asClient(store: FakeSupabase): SupabaseClient {
  return store as unknown as SupabaseClient;
}

test("fresh message events flow through channel, conversation, messages, and ledger", async () => {
  const previous = process.env.WORKSPACE_SAFETY_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";
  try {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);

  const summary = await processWhatsAppEvents(asClient(store), provider, [
    makeTextEvent({ eventId: "wamid.fresh-1" }),
  ]);

  assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });

  const conversations = store.tables["conversations"] ?? [];
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0]?.user_id, "owner-1");
  assert.equal(conversations[0]?.workspace_id, "workspace-1");
  assert.equal(conversations[0]?.customer_wa_id, "15557771234");
  assert.equal(conversations[0]?.ai_employee_id, "emp-1");

  const messages = store.tables["messages"] ?? [];
  assert.equal(messages.length, 2);

  const inbound = messages.find((row) => row.direction === "inbound");
  assert.ok(inbound);
  assert.equal(inbound.wa_message_id, "wamid.fresh-1");
  assert.equal(inbound.user_id, "owner-1");
  assert.equal(inbound.workspace_id, "workspace-1");
  assert.equal(inbound.status, "received");

  const outbound = messages.find((row) => row.direction === "outbound");
  assert.ok(outbound);
  assert.equal(outbound.status, "draft_blocked");
  assert.equal(outbound.user_id, "owner-1");
  assert.equal(outbound.workspace_id, "workspace-1");
  assert.ok(String(outbound.body).includes("Bright Dental"));

  const ledger = store.tables["webhook_events"] ?? [];
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]?.status, "processed");
  } finally {
    if (previous === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previous;
  }
});

test("an unassigned channel stores inbound safely without generating an AI draft", async () => {
  const previousSafety = process.env.WORKSPACE_SAFETY_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";

  try {
    const store = new FakeSupabase();
    seedOwnerWorkspace(store);
    store.tables["whatsapp_channels"][0]!.ai_employee_id = null;
    const mustNotRunProvider = {
      name: "must-not-run",
      async generateReply() {
        throw new Error("provider must not run for an unassigned channel");
      },
    };

    const summary = await processWhatsAppEvents(asClient(store), mustNotRunProvider, [
      makeTextEvent({ eventId: "wamid.unassigned-1" }),
    ]);

    assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });
    const messages = store.tables["messages"] ?? [];
    assert.equal(messages.filter((row) => row.direction === "inbound").length, 1);
    assert.equal(messages.filter((row) => row.direction === "outbound").length, 0);
    assert.equal(store.tables["conversations"]?.[0]?.ai_employee_id, null);
  } finally {
    if (previousSafety === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previousSafety;
  }
});

test("channel assignment selects the exact active employee instead of the oldest employee", async () => {
  const previousSafety = process.env.WORKSPACE_SAFETY_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";

  try {
    const store = new FakeSupabase();
    seedOwnerWorkspace(store);
    store.tables["ai_employees"]?.unshift({
      id: "emp-old",
      workspace_id: "workspace-1",
      name: "Wrong",
      business_name: "Wrong Business",
      greeting_message: "Wrong greeting",
      knowledge_notes: "",
      lifecycle_status: "Active",
      automation_paused: false,
      created_at: "2025-01-01T00:00:00Z",
    });
    store.tables["whatsapp_channels"][0]!.ai_employee_id = "emp-1";
    let receivedBusiness = "";
    const inspectingProvider = {
      name: "inspecting",
      async generateReply(input: { businessName: string }) {
        receivedBusiness = input.businessName;
        return `Assigned to ${input.businessName}`;
      },
    };

    const summary = await processWhatsAppEvents(asClient(store), inspectingProvider, [
      makeTextEvent({ eventId: "wamid.assigned-1" }),
    ]);

    assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });
    assert.equal(receivedBusiness, "Bright Dental");
    assert.equal(store.tables["conversations"]?.[0]?.ai_employee_id, "emp-1");
  } finally {
    if (previousSafety === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previousSafety;
  }
});

test("an existing conversation follows an authoritative channel reassignment", async () => {
  const previousSafety = process.env.WORKSPACE_SAFETY_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";

  try {
    const store = new FakeSupabase();
    seedOwnerWorkspace(store);
    store.tables["conversations"] = [{
      id: "conversation-1",
      user_id: "owner-1",
      workspace_id: "workspace-1",
      ai_employee_id: "emp-old",
      customer_wa_id: "15557771234",
    }];

    const summary = await processWhatsAppEvents(asClient(store), provider, [
      makeTextEvent({ eventId: "wamid.reassigned-1" }),
    ]);

    assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });
    assert.equal(store.tables["conversations"]?.[0]?.ai_employee_id, "emp-1");
    assert.ok(
      store.updates.some(
        ({ table, patch }) => table === "conversations" && patch.ai_employee_id === "emp-1",
      ),
    );
  } finally {
    if (previousSafety === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previousSafety;
  }
});

test("assignment rollout disabled fails closed even when a channel has an employee id", async () => {
  const previousAssignment = process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED;
  const previousSafety = process.env.WORKSPACE_SAFETY_ENABLED;
  process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED = "false";
  process.env.WORKSPACE_SAFETY_ENABLED = "true";

  try {
    const store = new FakeSupabase();
    seedOwnerWorkspace(store);
    const summary = await processWhatsAppEvents(asClient(store), provider, [
      makeTextEvent({ eventId: "wamid.assignment-off-1" }),
    ]);

    assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });
    assert.equal((store.tables["messages"] ?? []).filter((row) => row.direction === "outbound").length, 0);
    assert.equal(store.tables["conversations"]?.[0]?.ai_employee_id, null);
  } finally {
    if (previousAssignment === undefined) delete process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED;
    else process.env.WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED = previousAssignment;
    if (previousSafety === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previousSafety;
  }
});

test("verified Knowledge v0 FAQ creates a deterministic draft without calling the AI provider", async () => {
  const previousSafety = process.env.WORKSPACE_SAFETY_ENABLED;
  const previousKnowledge = process.env.KNOWLEDGE_V0_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";
  process.env.KNOWLEDGE_V0_ENABLED = "true";

  try {
    const store = new FakeSupabase();
    seedOwnerWorkspace(store);
    store.tables["knowledge_entries"] = [{
      id: "knowledge-1",
      workspace_id: "workspace-1",
      ai_employee_id: "emp-1",
      kind: "faq",
      title: "Opening hours",
      question: "When are you open?",
      content: "We are open Monday to Friday, 9 AM to 5 PM.",
      verified: true,
      created_by: "owner-1",
      updated_by: "owner-1",
      created_at: "2026-08-27T00:00:00Z",
      updated_at: "2026-08-27T00:00:00Z",
    }];
    const mustNotRunProvider = {
      name: "must-not-run",
      async generateReply() {
        throw new Error("provider should not run for a verified FAQ match");
      },
    };

    const summary = await processWhatsAppEvents(asClient(store), mustNotRunProvider, [
      makeTextEvent({ eventId: "wamid.knowledge-1", body: "Hi, when are you open?" }),
    ]);

    assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });
    const outbound = (store.tables["messages"] ?? []).find((row) => row.direction === "outbound");
    assert.equal(outbound?.status, "draft_blocked");
    assert.equal(outbound?.body, "We are open Monday to Friday, 9 AM to 5 PM.");
  } finally {
    if (previousSafety === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previousSafety;
    if (previousKnowledge === undefined) delete process.env.KNOWLEDGE_V0_ENABLED;
    else process.env.KNOWLEDGE_V0_ENABLED = previousKnowledge;
  }
});

test("Knowledge v0 sends only verified structured context to the AI provider", async () => {
  const previousSafety = process.env.WORKSPACE_SAFETY_ENABLED;
  const previousKnowledge = process.env.KNOWLEDGE_V0_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";
  process.env.KNOWLEDGE_V0_ENABLED = "true";

  try {
    const store = new FakeSupabase();
    seedOwnerWorkspace(store);
    store.tables["ai_employees"][0]!.knowledge_notes = "Legacy unverified note.";
    store.tables["knowledge_entries"] = [
      {
        id: "knowledge-verified",
        workspace_id: "workspace-1",
        ai_employee_id: "emp-1",
        kind: "note",
        title: "Services",
        question: "",
        content: "Verified service list.",
        verified: true,
        updated_at: "2026-08-27T00:00:00Z",
      },
      {
        id: "knowledge-draft",
        workspace_id: "workspace-1",
        ai_employee_id: "emp-1",
        kind: "note",
        title: "Draft",
        question: "",
        content: "Draft internal note.",
        verified: false,
        updated_at: "2026-08-27T00:00:01Z",
      },
    ];
    const inspectingProvider = {
      name: "context-inspector",
      async generateReply(context: { knowledgeNotes: string }) {
        assert.match(context.knowledgeNotes, /Verified service list/);
        assert.doesNotMatch(context.knowledgeNotes, /Legacy unverified note/);
        assert.doesNotMatch(context.knowledgeNotes, /Draft internal note/);
        return "Verified-context draft.";
      },
    };

    const summary = await processWhatsAppEvents(asClient(store), inspectingProvider, [
      makeTextEvent({ eventId: "wamid.knowledge-context", body: "Tell me about your services." }),
    ]);

    assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });
    const outbound = (store.tables["messages"] ?? []).find((row) => row.direction === "outbound");
    assert.equal(outbound?.body, "Verified-context draft.");
    assert.equal(outbound?.status, "draft_blocked");
  } finally {
    if (previousSafety === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previousSafety;
    if (previousKnowledge === undefined) delete process.env.KNOWLEDGE_V0_ENABLED;
    else process.env.KNOWLEDGE_V0_ENABLED = previousKnowledge;
  }
});

test("replaying an event id is deduplicated without touching conversations", async () => {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);
  store.tables["webhook_events"] = [
    { id: "evt-existing", event_id: "wamid.dup-1", status: "processed", attempts: 0 },
  ];

  const summary = await processWhatsAppEvents(asClient(store), provider, [
    makeTextEvent({ eventId: "wamid.dup-1" }),
  ]);

  assert.deepEqual(summary, { accepted: 0, duplicates: 1, skipped: 0, failed: 0 });
  assert.equal((store.tables["conversations"] ?? []).length, 0);
  assert.equal((store.tables["messages"] ?? []).length, 0);
});

test("events from unregistered channels are skipped and never stored", async () => {
  const store = new FakeSupabase();

  const summary = await processWhatsAppEvents(asClient(store), provider, [
    makeTextEvent({ phoneNumberId: "unknown-phone" }),
  ]);

  assert.deepEqual(summary, { accepted: 0, duplicates: 0, skipped: 1, failed: 0 });

  const ledger = store.tables["webhook_events"] ?? [];
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]?.status, "skipped");
  assert.equal(ledger[0]?.last_error, "unknown_channel");
  assert.equal((store.tables["conversations"] ?? []).length, 0);
});

test("processing failures mark the ledger failed and retries recover", async () => {
  const previous = process.env.WORKSPACE_SAFETY_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";
  try {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);
  store.failingInsertTables = ["conversations"];

  const firstSummary = await processWhatsAppEvents(asClient(store), provider, [
    makeTextEvent({ eventId: "wamid.retry-1" }),
  ]);

  assert.deepEqual(firstSummary, { accepted: 0, duplicates: 0, skipped: 0, failed: 1 });

  const ledger = store.tables["webhook_events"] ?? [];
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]?.status, "failed");
  assert.equal(ledger[0]?.attempts, 1);
  assert.match(String(ledger[0]?.last_error), /Creating conversation failed/);

  store.failingInsertTables = [];

  const retrySummary = await retryFailedWebhookEvents(asClient(store), provider);

  assert.deepEqual(retrySummary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });

  const retriedLedger = store.tables["webhook_events"] ?? [];
  assert.equal(retriedLedger[0]?.status, "processed");
  assert.equal((store.tables["messages"] ?? []).length, 2);
  } finally {
    if (previous === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previous;
  }
});

test("a previously stored message id is treated as success without a second reply", async () => {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);
  store.enforceMessageUnique = true;
  store.tables["messages"] = [
    {
      id: "msg-existing",
      conversation_id: "conv-existing",
      user_id: "owner-1",
      direction: "inbound",
      wa_message_id: "wamid.stored-1",
      message_type: "text",
      body: "earlier delivery",
      status: "received",
    },
  ];
  store.tables["conversations"] = [
    { id: "conv-existing", user_id: "owner-1", workspace_id: "workspace-1", customer_wa_id: "15557771234", ai_employee_id: "emp-1" },
  ];

  const summary = await processWhatsAppEvents(asClient(store), provider, [
    makeTextEvent({ eventId: "wamid.stored-1" }),
  ]);

  assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });

  const messages = store.tables["messages"] ?? [];
  assert.equal(messages.length, 1);
  assert.ok(!messages.some((row) => row.direction === "outbound"));

  const ledger = store.tables["webhook_events"] ?? [];
  assert.equal(ledger[0]?.status, "processed");
  assert.equal(ledger[0]?.last_error, "duplicate_message_id");
});

test("unsupported message types store history but generate no mock reply", async () => {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);

  const summary = await processWhatsAppEvents(asClient(store), provider, [
    makeTextEvent({ eventId: "wamid.media-1", messageType: "unsupported", body: "" }),
  ]);

  assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });

  const messages = store.tables["messages"] ?? [];
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.message_type, "unsupported");
});

test("workspace kill switch stores inbound history but generates no AI draft", async () => {
  const previous = process.env.WORKSPACE_SAFETY_ENABLED;
  process.env.WORKSPACE_SAFETY_ENABLED = "true";
  try {
    const store = new FakeSupabase();
    seedOwnerWorkspace(store);
    store.tables["workspaces"] = [{ id: "workspace-1", automation_paused: true }];
    const summary = await processWhatsAppEvents(asClient(store), provider, [makeTextEvent()]);
    assert.equal(summary.accepted, 1);
    const messages = store.tables["messages"] ?? [];
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.direction, "inbound");
  } finally {
    if (previous === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previous;
  }
});

test("workspace safety fails closed when the feature flag is unset or false", async () => {
  const previous = process.env.WORKSPACE_SAFETY_ENABLED;

  try {
    for (const configured of [undefined, "false"] as const) {
      if (configured === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
      else process.env.WORKSPACE_SAFETY_ENABLED = configured;

      const store = new FakeSupabase();
      seedOwnerWorkspace(store);
      store.tables["workspaces"] = [{ id: "workspace-1", automation_paused: false }];

      const summary = await processWhatsAppEvents(asClient(store), provider, [
        makeTextEvent({ eventId: `wamid.safety-${configured ?? "unset"}` }),
      ]);

      assert.equal(summary.accepted, 1);
      const messages = store.tables["messages"] ?? [];
      assert.equal(messages.length, 1, `safety flag ${configured ?? "unset"} must block AI drafts`);
      assert.equal(messages[0]?.direction, "inbound");
    }
  } finally {
    if (previous === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
    else process.env.WORKSPACE_SAFETY_ENABLED = previous;
  }
});

for (const lifecycleStatus of ["Draft", "Paused", "Archived"] as const) {
  test(`${lifecycleStatus} employees never generate AI drafts`, async () => {
    const previous = process.env.WORKSPACE_SAFETY_ENABLED;
    process.env.WORKSPACE_SAFETY_ENABLED = "true";

    try {
      const store = new FakeSupabase();
      seedOwnerWorkspace(store);
      store.tables["workspaces"] = [{ id: "workspace-1", automation_paused: false }];
      Object.assign(store.tables["ai_employees"]![0], {
        lifecycle_status: lifecycleStatus,
        automation_paused: true,
        // Deliberately retain the legacy status to prove it cannot bypass lifecycle safety.
        status: "Active",
      });

      const summary = await processWhatsAppEvents(asClient(store), provider, [
        makeTextEvent({ eventId: `wamid.lifecycle-${lifecycleStatus.toLowerCase()}` }),
      ]);

      assert.equal(summary.accepted, 1);
      const messages = store.tables["messages"] ?? [];
      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.direction, "inbound");
    } finally {
      if (previous === undefined) delete process.env.WORKSPACE_SAFETY_ENABLED;
      else process.env.WORKSPACE_SAFETY_ENABLED = previous;
    }
  });
}

test("delivery receipts update only the owner's matching outbound message", async () => {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);
  store.tables["messages"] = [
    { id: "msg-out", user_id: "owner-1", workspace_id: "workspace-1", direction: "outbound", wa_message_id: "wamid.outbound-1", status: "received" },
    { id: "msg-other", user_id: "owner-2", direction: "outbound", wa_message_id: "wamid.other", status: "received" },
  ];

  const summary = await processWhatsAppEvents(asClient(store), provider, [makeStatusEvent()]);

  assert.deepEqual(summary, { accepted: 1, duplicates: 0, skipped: 0, failed: 0 });
  assert.equal(store.tables["messages"]?.[0]?.status, "delivered");
  assert.equal(store.tables["messages"]?.[1]?.status, "received");
  assert.equal(store.tables["webhook_events"]?.[0]?.event_kind, "status");
  assert.equal(store.tables["webhook_events"]?.[0]?.status, "processed");
});

test("delivery status progression never regresses read messages", async () => {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);
  store.tables["messages"] = [
    { id: "msg-out", user_id: "owner-1", workspace_id: "workspace-1", direction: "outbound", wa_message_id: "wamid.outbound-1", status: "received" },
  ];

  const summary = await processWhatsAppEvents(asClient(store), provider, [
    makeStatusEvent({ eventId: "status:wamid.outbound-1:read", status: "read" }),
    makeStatusEvent(),
  ]);

  assert.deepEqual(summary, { accepted: 2, duplicates: 0, skipped: 0, failed: 0 });
  assert.equal(store.tables["messages"]?.[0]?.status, "read");
  assert.equal(shouldApplyDeliveryStatus("read", "delivered"), false);
  assert.equal(shouldApplyDeliveryStatus("delivered", "read"), true);
});

test("unknown receipt messages are skipped and duplicate receipts deduplicate", async () => {
  const store = new FakeSupabase();
  seedOwnerWorkspace(store);
  const receipt = makeStatusEvent();

  const first = await processWhatsAppEvents(asClient(store), provider, [receipt]);
  const second = await processWhatsAppEvents(asClient(store), provider, [receipt]);

  assert.deepEqual(first, { accepted: 0, duplicates: 0, skipped: 1, failed: 0 });
  assert.deepEqual(second, { accepted: 0, duplicates: 1, skipped: 0, failed: 0 });
  assert.equal(store.tables["webhook_events"]?.[0]?.last_error, "unknown_message");
});


