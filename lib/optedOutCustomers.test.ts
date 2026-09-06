import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listOptedOutCustomers,
  optOutSourceLabel,
} from "./optedOutCustomers.ts";

test("listOptedOutCustomers queries opted-out conversations newest opt-out first", async () => {
  const calls: string[] = [];
  const query: Record<string, unknown> = {
    not: async (_col: string, _condition: unknown, _value: unknown) => {
      calls.push("not");
      return query;
    },
    order: async (_col: string, _options: unknown) => {
      calls.push("order");
      return {
        data: [
          {
            id: "c1",
            customer_wa_id: "15551234567",
            customer_opted_out_at: "2026-09-01T08:00:00.000Z",
            customer_opt_out_source: "whatsapp_keyword",
            last_message_at: "2026-09-02T08:00:00.000Z",
            created_at: "2026-08-01T08:00:00.000Z",
          },
        ],
        error: null,
      };
    },
  };
  const client = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;

  const result = await listOptedOutCustomers(client);
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0].customer_opt_out_source, "whatsapp_keyword");
  assert.deepEqual(calls, ["not", "order"]);
});

test("listOptedOutCustomers maps database errors to a typed failure", async () => {
  const client = {
    from: () => ({
      select: () => ({
        not: async () => ({ data: null, error: { message: "rls denied" } }),
      }),
    }),
  } as unknown as SupabaseClient;

  const result = await listOptedOutCustomers(client);
  assert.equal(result.data, null);
  assert.equal(result.error, "rls denied");
});

test("optOutSourceLabel maps sources to human labels", () => {
  assert.equal(optOutSourceLabel("whatsapp_keyword"), "WhatsApp stop keyword");
  assert.equal(optOutSourceLabel("system"), "System");
  assert.equal(optOutSourceLabel(null), "Unknown");
});