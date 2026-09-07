import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OPTED_OUT_LIST_LIMIT,
  listOptedOutCustomers,
  optOutSourceLabel,
} from "./optedOutCustomers.ts";

test("listOptedOutCustomers returns the newest opt-outs with an exact total and truncation flag", async () => {
  const calls: string[] = [];
  const rows = [
    {
      id: "c1",
      customer_wa_id: "15551234567",
      customer_opted_out_at: "2026-09-01T08:00:00.000Z",
      customer_opt_out_source: "whatsapp_keyword" as const,
      last_message_at: "2026-09-02T08:00:00.000Z",
      created_at: "2026-08-01T08:00:00.000Z",
    },
    {
      id: "c2",
      customer_wa_id: "15559876543",
      customer_opted_out_at: "2026-08-20T08:00:00.000Z",
      customer_opt_out_source: "whatsapp_keyword" as const,
      last_message_at: "2026-08-21T08:00:00.000Z",
      created_at: "2026-08-01T08:00:00.000Z",
    },
  ];
  const query = {
    select: (_cols?: string, options?: { count?: string; head?: boolean }) => {
      if (options?.head) {
        calls.push("count:head");
        return {
          not: () => Promise.resolve({ data: [], count: 12, error: null }),
        };
      }
      calls.push("list");
      return {
        not: () => {
          calls.push("not");
          return {
            order: (_col: string, orderOptions: unknown) => {
              calls.push(`order:${JSON.stringify(orderOptions)}`);
              return {
                limit: (limitCount: number) => {
                  calls.push(`limit:${limitCount}`);
                  return { data: rows, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  const client = { from: () => query } as unknown as SupabaseClient;

  const result = await listOptedOutCustomers(client);
  assert.equal(result.error, null);
  assert.deepEqual(result.data?.customers.map((customer) => customer.id), ["c1", "c2"]);
  assert.equal(result.data?.total, 12);
  assert.equal(result.data?.truncated, true);
  assert.deepEqual(calls, [
    "count:head",
    "list",
    "not",
    'order:{"ascending":false}',
    `limit:${OPTED_OUT_LIST_LIMIT}`,
  ]);
});

test("listOptedOutCustomers marks trimmed lists only when the total exceeds the cap", async () => {
  const row = {
    id: "c1",
    customer_wa_id: "15551234567",
    customer_opted_out_at: "2026-09-01T08:00:00.000Z",
    customer_opt_out_source: "whatsapp_keyword" as const,
    last_message_at: "2026-09-02T08:00:00.000Z",
    created_at: "2026-08-01T08:00:00.000Z",
  };
  const query = {
    select: (_cols?: string, options?: { count?: string; head?: boolean }) => {
      if (options?.head) {
        return { not: () => Promise.resolve({ data: [], count: 1, error: null }) };
      }
      return {
        not: () => ({
          order: () => ({ limit: () => ({ data: [row], error: null }) }),
        }),
      };
    },
  };
  const client = { from: () => query } as unknown as SupabaseClient;

  const result = await listOptedOutCustomers(client);
  assert.equal(result.error, null);
  assert.equal(result.data?.customers.length, 1);
  assert.equal(result.data?.total, 1);
  assert.equal(result.data?.truncated, false);
});

test("listOptedOutCustomers maps database errors to a typed failure", async () => {
  const client = {
    from: () => ({
      select: (_cols?: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          return { not: () => Promise.resolve({ data: [], count: 0, error: null }) };
        }
        return {
          not: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: "rls denied" } }) }) }),
        };
      },
    }),
  } as unknown as SupabaseClient;

  const result = await listOptedOutCustomers(client);
  assert.equal(result.data, null);
  assert.equal(result.error, "rls denied");
});

test("optOutSourceLabel maps sources to human labels", () => {
  assert.equal(optOutSourceLabel("whatsapp_keyword"), "WhatsApp stop keyword");
  assert.equal(optOutSourceLabel(null), "Unknown");
});