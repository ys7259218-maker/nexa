import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAppointmentReviewRepository } from "./appointmentSupabaseRepository.ts";

const ids = {
  actorId: "123e4567-e89b-42d3-a456-426614174009",
  workspaceId: "123e4567-e89b-42d3-a456-426614174000",
  conversationId: "123e4567-e89b-42d3-a456-426614174001",
  inboundMessageId: "123e4567-e89b-42d3-a456-426614174002",
};
const proposal = {
  kind: "appointment_request" as const,
  ...ids,
  requestedAt: "2026-10-01T14:30:00+05:30",
  customerRequest: "Please request an appointment",
  status: "pending_review" as const,
};
type Reply = { data?: unknown; error?: { code?: string } | null };
function clientFixture(input: {
  authenticated?: boolean;
  membership?: boolean;
  conversation?: boolean;
  inbound?: boolean;
  insert?: Reply;
  existing?: Reply;
} = {}) {
  const calls: Array<{ table: string; method: string; filters: Array<[string, unknown]> }> = [];
  const client = {
    auth: {
      async getUser() {
        return { data: { user: input.authenticated === false ? null : { id: ids.actorId } }, error: null };
      },
    },
    from(table: string) {
      const entry = { table, method: "", filters: [] as Array<[string, unknown]> };
      calls.push(entry);
      const chain = {
        select(fields: string) { entry.filters.push(["select", fields]); return chain; },
        eq(field: string, value: unknown) { entry.filters.push([field, value]); return chain; },
        in(field: string, value: unknown) { entry.filters.push([field, value]); return chain; },
        insert(value: unknown) { entry.method = "insert"; entry.filters.push(["insert", value]); return chain; },
        async maybeSingle() {
          if (table === "workspace_members") return { data: input.membership === false ? null : { role: "operator" }, error: null };
          if (table === "conversations") return { data: input.conversation === false ? null : { id: ids.conversationId }, error: null };
          if (table === "messages") return { data: input.inbound === false ? null : { id: ids.inboundMessageId }, error: null };
          return input.existing ?? { data: null, error: null };
        },
        async single() {
          return input.insert ?? { data: {
            workspace_id: proposal.workspaceId,
            inbound_message_id: proposal.inboundMessageId,
            requested_at: "2026-10-01T09:00:00.000Z",
            customer_request: proposal.customerRequest,
            status: "pending_review",
          }, error: null };
        },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("actor mismatch fails before reading workspace or inbound content", async () => {
  const f = clientFixture({ authenticated: false });
  assert.equal(await createAppointmentReviewRepository(f.client).ownsInboundMessage(ids), false);
  assert.equal(f.calls.length, 0);
});

test("workspace membership and conversation must be present before inbound read", async () => {
  for (const options of [{ membership: false }, { conversation: false }, { inbound: false }]) {
    const f = clientFixture(options);
    assert.equal(await createAppointmentReviewRepository(f.client).ownsInboundMessage(ids), false);
    const read = f.calls.find((entry) => entry.table === "messages");
    assert.equal(Boolean(read), options.membership !== false && options.conversation !== false);
  }
});

test("inbound read is scoped to workspace, conversation, and direction", async () => {
  const f = clientFixture();
  assert.equal(await createAppointmentReviewRepository(f.client).ownsInboundMessage(ids), true);
  const message = f.calls.find((entry) => entry.table === "messages");
  assert.ok(message);
  assert.ok(message.filters.some(([field, value]) => field === "workspace_id" && value === ids.workspaceId));
  assert.ok(message.filters.some(([field, value]) => field === "conversation_id" && value === ids.conversationId));
  assert.ok(message.filters.some(([field, value]) => field === "direction" && value === "inbound"));
});

test("successful insert returns pending review even if Postgres normalizes timestamp to UTC", async () => {
  const f = clientFixture();
  const result = await createAppointmentReviewRepository(f.client).savePendingProposal(proposal);
  assert.deepEqual(result, {
    workspaceId: proposal.workspaceId, inboundMessageId: proposal.inboundMessageId,
    requestedAt: "2026-10-01T09:00:00.000Z",
    customerRequest: proposal.customerRequest, status: "pending_review",
  });
  assert.equal(f.calls.some((entry) => entry.table === "appointment_review_requests" && entry.method === "insert"), true);
});

test("unique conflict is an exact scoped read and refuses conflicting request text", async () => {
  const f = clientFixture({
    insert: { data: null, error: { code: "23505" } },
    existing: { data: {
      workspace_id: ids.workspaceId, inbound_message_id: ids.inboundMessageId,
      requested_at: "2026-10-01T09:00:00.000Z",
      customer_request: "Another request", status: "pending_review",
    }, error: null },
  });
  assert.equal(await createAppointmentReviewRepository(f.client).savePendingProposal(proposal), null);
  const read = f.calls.find((entry) => entry.table === "appointment_review_requests" && entry.method !== "insert");
  assert.ok(read);
  assert.ok(read.filters.some(([field, value]) => field === "workspace_id" && value === ids.workspaceId));
  assert.ok(read.filters.some(([field, value]) => field === "inbound_message_id" && value === ids.inboundMessageId));
});

test("unexpected storage errors never claim a successful request", async () => {
  const f = clientFixture({ insert: { data: null, error: { code: "42501" } } });
  assert.equal(await createAppointmentReviewRepository(f.client).savePendingProposal(proposal), null);
});

test("direct repository write refuses unauthenticated actor without touching queue", async () => {
  const f = clientFixture({ authenticated: false });
  assert.equal(await createAppointmentReviewRepository(f.client).savePendingProposal(proposal), null);
  assert.equal(f.calls.some((entry) => entry.table === "appointment_review_requests"), false);
});

test("direct repository write refuses unauthorized or missing inbound source", async () => {
  for (const options of [{ membership: false }, { conversation: false }, { inbound: false }]) {
    const f = clientFixture(options);
    assert.equal(await createAppointmentReviewRepository(f.client).savePendingProposal(proposal), null);
    assert.equal(f.calls.some((entry) => entry.table === "appointment_review_requests"), false);
  }
});
