import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeeklySeries,
  computeSuccessRatePercent,
  formatCallDuration,
  getDashboardSnapshot,
  isSameLocalDay,
  recordActivityEvent,
} from "./dashboard.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type TerminalResult = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

class FakeQuery {
  calls: Array<{ method: string; args: unknown }> = [];

  private readonly result: TerminalResult;

  constructor(result: TerminalResult) {
    this.result = result;
  }

  #record(method: string, args?: unknown): this {
    this.calls.push({ method, args });
    return this;
  }

  select(args?: unknown, options?: unknown) {
    return this.#record("select", { args, options });
  }

  order(column: string, options?: unknown) {
    return this.#record("order", { column, options });
  }

  limit(value: number) {
    return this.#record("limit", value);
  }

  gte(column: string, value: unknown) {
    return this.#record("gte", { column, value });
  }

  eq(column: string, value: unknown) {
    return this.#record("eq", { column, value });
  }

  insert(payload: unknown) {
    return this.#record("insert", payload);
  }

  then(
    resolve: (value: { data: unknown; error: unknown; count: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) {
    return Promise.resolve({
      data: this.result.data ?? null,
      error: this.result.error ?? null,
      count: this.result.count ?? null,
    }).then(resolve, reject);
  }
}

function createFakeClient(results: TerminalResult[]) {
  const queue = [...results];
  const tables: string[] = [];

  const client = {
    from(table: string) {
      tables.push(table);
      const result = queue.shift();
      if (!result) {
        throw new Error(`Unexpected query against ${table}`);
      }
      return new FakeQuery(result);
    },
  } as unknown as SupabaseClient;

  return { client, getTables: () => tables };
}

test("isSameLocalDay compares calendar days", () => {
  assert.equal(
    isSameLocalDay(new Date(2026, 0, 15, 8, 0), new Date(2026, 0, 15, 23, 30)),
    true,
  );
  assert.equal(
    isSameLocalDay(new Date(2026, 0, 15, 1, 0), new Date(2026, 0, 16, 1, 0)),
    false,
  );
});

test("buildWeeklySeries covers the last seven days ending today", () => {
  const now = new Date(2026, 2, 11, 12, 0);

  const series = buildWeeklySeries(now, [
    { created_at: new Date(2026, 2, 5, 9, 0).toISOString() },
    { created_at: new Date(2026, 2, 11, 10, 0).toISOString() },
    { created_at: new Date(2026, 2, 11, 18, 0).toISOString() },
  ]);

  assert.equal(series.length, 7);
  assert.equal(series[6].day, "Wed");
  assert.deepEqual(series.slice(-3), [
    { day: "Mon", calls: 0 },
    { day: "Tue", calls: 0 },
    { day: "Wed", calls: 2 },
  ]);
  assert.equal(series[0].calls, 1);
});

test("computeSuccessRatePercent returns null without calls and rounds otherwise", () => {
  assert.equal(computeSuccessRatePercent([]), null);
  assert.equal(computeSuccessRatePercent([{ status: "Completed" }]), 100);
  assert.equal(
    computeSuccessRatePercent([
      { status: "Completed" },
      { status: "Missed" },
      { status: "Booked" },
    ]),
    33,
  );
});

test("formatCallDuration renders minutes and zero-padded seconds", () => {
  assert.equal(formatCallDuration(0), "0m 00s");
  assert.equal(formatCallDuration(41), "0m 41s");
  assert.equal(formatCallDuration(204), "3m 24s");
});

test("getDashboardSnapshot queries owner-scoped tables and derives metrics", async () => {
  const now = new Date(2026, 7, 24, 12, 0);
  const weekStart = new Date(startOfDayCopy(now));
  weekStart.setDate(weekStart.getDate() - 6);

  const fake = createFakeClient([
    { data: [{ id: "call-1", customer: "Ana", status: "Completed", duration_seconds: 61, created_at: now.toISOString(), user_id: "u1", ai_employee_id: null }] },
    { data: [{ created_at: now.toISOString(), status: "Completed" }] },
    { data: [] },
    { count: 4 },
    { data: [{ id: "act-1", user_id: "u1", category: "general", message: "Nexa Receptionist created" }] },
    { count: 7 },
    { count: 3 },
    { count: 2 },
  ]);

  const result = await getDashboardSnapshot(fake.client, now);

  assert.equal(result.error, null);
  assert.ok(result.snapshot);
  assert.equal(result.snapshot.callsToday, 1);
  assert.equal(result.snapshot.upcomingAppointments, 4);
  assert.equal(result.snapshot.whatsappActivityRecords, 7);
  assert.equal(result.snapshot.openConversations, 3);
  assert.equal(result.snapshot.pendingDrafts, 2);
  assert.equal(result.snapshot.successRatePercent, 100);
  assert.equal(result.snapshot.recentCalls.length, 1);
  assert.equal(result.snapshot.activities.length, 1);
  assert.equal(result.snapshot.weeklyCalls.length, 7);

  const tables = fake.getTables();
  assert.deepEqual(tables, [
    "calls",
    "calls",
    "appointments",
    "appointments",
    "activity_events",
    "activity_events",
    "conversations",
    "messages",
  ]);
});

test("getDashboardSnapshot surfaces the first query error", async () => {
  const fake = createFakeClient([
    { error: { message: "permission denied" } },
    { data: [] },
    { data: [] },
    { count: 0 },
    { data: [] },
    { count: 0 },
    { count: 0 },
    { count: 0 },
  ]);

  const result = await getDashboardSnapshot(fake.client);

  assert.deepEqual(result, { error: "permission denied", snapshot: null });
});

test("recordActivityEvent inserts trimmed message with category", async () => {
  const fake = createFakeClient([{}]);

  const result = await recordActivityEvent(fake.client, {
    message: "  Nexa Receptionist created  ",
  });

  assert.deepEqual(result, { error: null });

  const tables = fake.getTables();
  assert.deepEqual(tables, ["activity_events"]);
});

function startOfDayCopy(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
