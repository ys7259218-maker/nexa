import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseWebhookStatusFilter,
  webhookStatusLabel,
  listWebhookEvents,
} from "./webhookLedger.ts";

test("parseWebhookStatusFilter accepts only known statuses and defaults to all", () => {
  assert.equal(parseWebhookStatusFilter("all"), "all");
  assert.equal(parseWebhookStatusFilter("claimed"), "claimed");
  assert.equal(parseWebhookStatusFilter("processed"), "processed");
  assert.equal(parseWebhookStatusFilter("skipped"), "skipped");
  assert.equal(parseWebhookStatusFilter("failed"), "failed");
  assert.equal(parseWebhookStatusFilter(undefined), "all");
  assert.equal(parseWebhookStatusFilter("procssed"), "all");
  assert.equal(parseWebhookStatusFilter(42), "all");
  assert.equal(parseWebhookStatusFilter("failed; drop table"), "all");
});

test("webhookStatusLabel maps every status to a display label", () => {
  assert.equal(webhookStatusLabel("claimed"), "Claimed");
  assert.equal(webhookStatusLabel("processed"), "Processed");
  assert.equal(webhookStatusLabel("skipped"), "Skipped");
  assert.equal(webhookStatusLabel("failed"), "Failed");
});

test("listWebhookEvents reports unconfigured without throwing", async () => {
  const result = await listWebhookEvents(() => null, "all");
  assert.ok(result.error);
  assert.equal(result.data, null);
});

test("listWebhookEvents applies the status filter and order on the query", async () => {
  const calls: string[] = [];

  const query: Record<string, unknown> = {
    eq: async (_col: string, _value: string) => {
      calls.push("eq");
      return query;
    },
    order: async (_col: string) => {
      calls.push("order");
      return query;
    },
    limit: async (_n: number) => {
      calls.push("limit");
      return query;
    },
  };
  const client = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;

  await listWebhookEvents(() => client, "failed");
  assert.deepEqual(calls, ["eq", "order", "limit"]);
});

test("listWebhookEvents skips status filtering for all", async () => {
  const calls: string[] = [];

  const query: Record<string, unknown> = {
    order: async (_col: string) => {
      calls.push("order");
      return query;
    },
    limit: async (_n: number) => {
      calls.push("limit");
      return query;
    },
    eq: async () => {
      throw new Error("eq must not be called for all");
    },
  };
  const client = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;

  await listWebhookEvents(() => client, "all");
  assert.deepEqual(calls, ["order", "limit"]);
});

test("listWebhookEvents maps database errors to a typed failure", async () => {
  const client = {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: null, error: { message: "permission denied" } }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const result = await listWebhookEvents(() => client, "all");
  assert.equal(result.data, null);
  assert.equal(result.error, "permission denied");
});