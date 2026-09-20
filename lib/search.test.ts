import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeLikeTerm, searchWorkspace, type SearchResultGroup } from "./search.ts";

type Row = Record<string, unknown>;

type QueryResult = {
  data: Row[] | null;
  error: { message: string } | null;
};

class FakeSearchQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private readonly table: string;
  private readonly results: Record<string, Row[]>;
  private readonly failures: Record<string, string>;

  constructor(table: string, results: Record<string, Row[]>, failures: Record<string, string>) {
    this.table = table;
    this.results = results;
    this.failures = failures;
  }

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
    return this;
  }

  or(filter: string) {
    this.calls.push({ method: "or", args: [filter] });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.calls.push({ method: "ilike", args: [column, value] });
    return this;
  }

  limit(count: number) {
    this.calls.push({ method: "limit", args: [count] });
    return this;
  }

  then(resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) {
    const failure = this.failures[this.table];
    const result: QueryResult = failure
      ? { data: null, error: { message: failure } }
      : { data: this.results[this.table] ?? [], error: null };
    return Promise.resolve(result).then(resolve, reject);
  }
}

function fakeSearchClient(results: Record<string, Row[]>, failures: Record<string, string> = {}) {
  const calls: Array<{ table: string; query: FakeSearchQuery }> = [];
  const client = {
    from(table: string) {
      const query = new FakeSearchQuery(table, results, failures);
      calls.push({ table, query });
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("sanitizeLikeTerm strips LIKE and or() filter-breaker characters and collapses whitespace", () => {
  assert.equal(sanitizeLikeTerm("   Priya   "), "Priya");
  assert.equal(sanitizeLikeTerm("100% real customer"), "100 real customer");
  assert.equal(sanitizeLikeTerm("a_b_c"), "abc");
  assert.equal(sanitizeLikeTerm("quoted \"stuff\" here"), "quoted stuff here");
  assert.equal(sanitizeLikeTerm("backslash\\value"), "backslashvalue");
  assert.equal(sanitizeLikeTerm("L'oreal"), "Loreal");
  assert.equal(sanitizeLikeTerm("Aria\tO'Brien"), "Aria OBrien");
  assert.equal(sanitizeLikeTerm("a%_\"'\\b"), "ab");
});

test("sanitizeLikeTerm is bounded to 100 characters and keeps empty input empty", () => {
  assert.equal(sanitizeLikeTerm(""), "");
  assert.equal(sanitizeLikeTerm("    "), "");
  const longTerm = sanitizeLikeTerm("a".repeat(150));
  assert.equal(longTerm.length, 100);
  const longCollapsed = sanitizeLikeTerm("ab ".repeat(120));
  assert.equal(longCollapsed.length, 100);
  assert.ok(!longCollapsed.endsWith(" "), "whitespace collapse must not leave a trailing space");
});

test("searchWorkspace short-circuits an empty or whitespace-only query without issuing queries", async () => {
  const fake = fakeSearchClient({});
  for (const query of ["", "   ", "\t"]) {
    const result = await searchWorkspace(fake.client, query);
    assert.deepEqual(result, { data: { groups: [], total: 0 }, error: null });
  }
  assert.equal(fake.calls.length, 0, "no table queries must be issued for an unusable term");
});

test("searchWorkspace issues five sanitized, bounded queries and builds typed groups", async () => {
  const longBody = `word-${"x".repeat(120)}`;
  const fake = fakeSearchClient({
    ai_employees: [
      { id: "e1", name: "Aria O'Brien", business_name: "Nexa Co", department: "Support" },
    ],
    conversations: [{ id: "c1", customer_wa_id: "15551234567", last_message_at: "2026-09-06T10:00:00.000Z" }],
    messages: [{ id: "m1", conversation_id: "c1", body: longBody, direction: "inbound", status: "received" }],
    calls: [{ id: "call1", customer: "Buyer One", status: "completed", duration_seconds: 42 }],
    appointments: [
      { id: "a1", customer: "Buyer One", service: "Order 7", location: "Main St", scheduled_at: "2026-09-07T09:00:00.000Z" },
    ],
  });

  const result = await searchWorkspace(fake.client, `Aria O'Brien  "quoted" 50%`);

  assert.equal(result.error, null);
  const groups = (result.data as { groups: SearchResultGroup[] }).groups;

  assert.deepEqual(
    groups.map((group) => group.id),
    ["ai_employees", "conversations", "messages", "calls", "appointments"],
  );
  assert.equal(result.data?.total, 5);

  assert.deepEqual(groups[0].items, [
    {
      id: "e1",
      title: "Aria O'Brien",
      subtitle: "Nexa Co · Support",
      href: "/ai-employees/e1",
    },
  ]);

  assert.equal(groups[1].items.length, 1);
  assert.equal(groups[1].items[0].id, "c1");
  assert.equal(groups[1].items[0].title, "WhatsApp contact •••• 4567");
  assert.match(groups[1].items[0].subtitle, /^Last message /);
  assert.equal(groups[1].items[0].href, "/conversations?conversation=c1");

  assert.equal(groups[2].items[0].title.length, 81, "snippet must cap the body at 80 chars plus the ellipsis");

  assert.equal(groups[3].items[0].subtitle, "completed · 42s");
  assert.match(groups[4].items[0].subtitle, /Order 7 · Main St ·/);

  const filterCalls = fake.calls.filter((call) => call.query.calls.some((entry) => entry.method === "or"));
  const ilikeCalls = fake.calls.flatMap((call) =>
    call.query.calls.filter((entry) => entry.method === "ilike"),
  );

  const employeesFilter = filterCalls[0].query.calls.find((entry) => entry.method === "or")!.args[0] as string;
  const appointmentsFilter = filterCalls[1].query.calls.find((entry) => entry.method === "or")!.args[0] as string;

  const term = sanitizeLikeTerm(`Aria O'Brien  "quoted" 50%`);
  assert.equal(term, "Aria OBrien quoted 50");
  const value = `%${term}%`;
  assert.equal(
    employeesFilter,
    ["name", "business_name", "department"].map((column) => `${column}.ilike."${value}"`).join(","),
    "the employee or() filter must embed exactly the sanitized term",
  );
  assert.equal(
    appointmentsFilter,
    ["customer", "service", "location"].map((column) => `${column}.ilike."${value}"`).join(","),
    "the appointment or() filter must embed exactly the sanitized term",
  );
  assert.doesNotMatch(employeesFilter + appointmentsFilter, /[\\'*]/);

  assert.equal(ilikeCalls.length, 3);
  assert.equal(ilikeCalls[0].args[0], "customer_wa_id");
  assert.equal(ilikeCalls[1].args[0], "body");
  assert.equal(ilikeCalls[2].args[0], "customer");
  for (const ilike of ilikeCalls) {
    assert.equal(ilike.args[1], value, "every ilike() value must be the sanitized term");
  }

  for (const call of fake.calls) {
    const limit = call.query.calls.find((entry) => entry.method === "limit");
    assert.equal(limit?.args[0], 5, `${call.table} results must be bounded`);
  }
});

test("searchWorkspace masks provider IDs and omits empty groups", async () => {
  const fake = fakeSearchClient({
    ai_employees: [{ id: "e1", name: "Priya", business_name: null, department: null }],
  });

  const result = await searchWorkspace(fake.client, "priya");

  assert.equal(result.error, null);
  const groups = (result.data as { groups: SearchResultGroup[] }).groups;
  assert.deepEqual(
    groups.map((group) => group.id),
    ["ai_employees"],
  );
  assert.deepEqual(groups[0].items, [
    { id: "e1", title: "Priya", subtitle: "", href: "/ai-employees/e1" },
  ]);
  assert.equal(result.data?.total, 1);
});

test("searchWorkspace reports a typed failure when any query errors", async () => {
  const fake = fakeSearchClient(
    { ai_employees: [{ id: "e1", name: "Priya" }] },
    { messages: "boom" },
  );

  const result = await searchWorkspace(fake.client, "priya");

  assert.equal(result.data, null);
  assert.equal(result.error, "boom");
});