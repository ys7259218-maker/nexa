import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listOutboundHistory,
  parseOutboundStatusFilter,
  parseOutboundTemplateFilter,
  previewBody,
} from "./outboundHistory.ts";

test("parseOutboundStatusFilter accepts only known statuses and defaults to all", () => {
  for (const value of ["all", "sent", "delivered", "read", "failed", "draft_blocked"]) {
    assert.equal(parseOutboundStatusFilter(value), value);
  }
  assert.equal(parseOutboundStatusFilter(undefined), "all");
  assert.equal(parseOutboundStatusFilter("send"), "all");
  assert.equal(parseOutboundStatusFilter(42), "all");
  assert.equal(parseOutboundStatusFilter("read; drop table"), "all");
});

test("parseOutboundTemplateFilter accepts only all, freeform, and template", () => {
  assert.equal(parseOutboundTemplateFilter("all"), "all");
  assert.equal(parseOutboundTemplateFilter("freeform"), "freeform");
  assert.equal(parseOutboundTemplateFilter("template"), "template");
  assert.equal(parseOutboundTemplateFilter(undefined), "all");
  assert.equal(parseOutboundTemplateFilter("templated"), "all");
  assert.equal(parseOutboundTemplateFilter(42), "all");
  assert.equal(parseOutboundTemplateFilter("template; drop table"), "all");
});

test("listOutboundHistory filters by direction and optional status with order", async () => {
  const calls: string[] = [];
  const query: Record<string, unknown> = {
    eq: async (_col: string, _value: unknown) => {
      calls.push("eq");
      return query;
    },
    order: async (_col: string) => {
      calls.push("order");
      return query;
    },
    limit: async (_n: number) => {
      calls.push("limit");
      return {
        data: [{ id: "m1", status: "failed" }],
        error: null,
      };
    },
  };
  const client = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;

  const result = await listOutboundHistory(client, "failed");
  assert.equal(result.error, null);
  assert.equal((result.data as { status: string }[])[0].status, "failed");
  assert.deepEqual(calls, ["eq", "eq", "order", "limit"]);
});

test("listOutboundHistory only filters by direction for all", async () => {
  const calls: string[] = [];
  const query: Record<string, unknown> = {
    eq: async (_col: string, _value: unknown) => {
      calls.push("eq");
      return query;
    },
    order: async (_col: string) => {
      calls.push("order");
      return query;
    },
    limit: async (_n: number) => {
      calls.push("limit");
      return { data: [], error: null };
    },
  };
  const client = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;

  await listOutboundHistory(client, "all");
  assert.deepEqual(calls, ["eq", "order", "limit"]);
});

test("listOutboundHistory filters template-only sends with not-is-null", async () => {
  const calls: string[] = [];
  const query: Record<string, unknown> = {
    eq: async (_col: string, _value: unknown) => {
      calls.push("eq");
      return query;
    },
    not: async (_col: string, _op: string, _value: unknown) => {
      calls.push("not");
      return query;
    },
    order: async (_col: string) => {
      calls.push("order");
      return query;
    },
    limit: async (_n: number) => {
      calls.push("limit");
      return { data: [], error: null };
    },
  };
  const client = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;

  await listOutboundHistory(client, "all", "template");
  assert.deepEqual(calls, ["eq", "not", "order", "limit"]);
});

test("listOutboundHistory filters free-form sends with is-null", async () => {
  const calls: string[] = [];
  const query: Record<string, unknown> = {
    eq: async (_col: string, _value: unknown) => {
      calls.push("eq");
      return query;
    },
    is: async (_col: string, _value: unknown) => {
      calls.push("is");
      return query;
    },
    order: async (_col: string) => {
      calls.push("order");
      return query;
    },
    limit: async (_n: number) => {
      calls.push("limit");
      return { data: [], error: null };
    },
  };
  const client = {
    from: () => ({ select: () => query }),
  } as unknown as SupabaseClient;

  await listOutboundHistory(client, "all", "freeform");
  assert.deepEqual(calls, ["eq", "is", "order", "limit"]);
});

test("listOutboundHistory maps database errors to a typed failure", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: null, error: { message: "rls denied" } }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const result = await listOutboundHistory(client, "read");
  assert.equal(result.data, null);
  assert.equal(result.error, "rls denied");
});

test("previewBody trims whitespace and truncates at a word boundary", () => {
  assert.equal(previewBody("  hello   world  "), "hello world");
  assert.equal(
    previewBody("short"),
    "short",
  );
  const long = "a ".repeat(200).trim();
  const preview = previewBody(long);
  assert.ok(preview.endsWith("…"));
  assert.ok(preview.length <= 97, "preview stays within max chars plus ellipsis");
  assert.equal(previewBody(""), "");
});