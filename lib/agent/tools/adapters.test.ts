import assert from "node:assert/strict";
import test from "node:test";

import {
  createMockCalendarReadAdapter,
  createMockFileReadAdapter,
  createMockToolAdapters,
  createMockWebResearchAdapter,
} from "./adapters.ts";
import { ToolError } from "./errors.ts";
import { toolAdapterKey } from "./types.ts";

const context = {
  workspaceId: "workspace-a",
  invocationKey: "adapter-1",
  now: () => new Date("2026-11-09T00:00:00.000Z"),
};

test("mock file adapter is deterministic and never reads a real file", async () => {
  const adapter = createMockFileReadAdapter();
  const first = await adapter({ path: "notes.txt", maxBytes: 100 }, context);
  const second = await adapter({ path: "notes.txt", maxBytes: 100 }, context);

  assert.deepEqual(first, second);
  assert.equal(first.path, "notes.txt");
  assert.equal(first.mediaType, "text/plain");
  assert.match(String(first.contentHash), /^[0-9a-f]{64}$/);
  assert.equal(first.byteLength, 100);
});

test("mock file adapter rejects invalid direct calls", async () => {
  const adapter = createMockFileReadAdapter();
  await assert.rejects(
    () => adapter({ path: "" }, context),
    (error: unknown) =>
      error instanceof ToolError && error.errorClass === "VALIDATION",
  );
  await assert.rejects(
    () => adapter({ path: "notes.txt", maxBytes: 0 }, context),
    (error: unknown) =>
      error instanceof ToolError && error.code === "invalid_max_bytes",
  );
});

test("mock web adapter returns deterministic reserved-invalid results", async () => {
  const adapter = createMockWebResearchAdapter();
  const result = await adapter({ query: "research query", maxResults: 2 }, context);

  assert.match(String(result.queryHash), /^[0-9a-f]{64}$/);
  const results = result.results as Array<Record<string, unknown>>;
  assert.equal(results.length, 2);
  for (const entry of results) {
    assert.match(String(entry.url), /^https:\/\/example\.invalid\//);
    assert.match(String(entry.snippetHash), /^[0-9a-f]{64}$/);
  }

  const again = await adapter({ query: "research query", maxResults: 2 }, context);
  assert.deepEqual(result, again);
});

test("calendar adapter is closed by default and returns PERMISSION", async () => {
  const adapter = createMockCalendarReadAdapter();
  await assert.rejects(
    () =>
      adapter(
        {
          timeMin: "2026-11-09T09:00:00.000Z",
          timeMax: "2026-11-09T10:00:00.000Z",
        },
        context,
      ),
    (error: unknown) =>
      error instanceof ToolError && error.errorClass === "PERMISSION",
  );
});

test("open calendar gate returns deterministic mock events", async () => {
  const adapter = createMockCalendarReadAdapter({
    gate: { canRead: () => true },
    calendarId: "mock-test-calendar",
  });
  const result = await adapter(
    {
      timeMin: "2026-11-09T09:00:00.000Z",
      timeMax: "2026-11-09T10:00:00.000Z",
      maxResults: 2,
    },
    context,
  );

  assert.equal(result.calendarId, "mock-test-calendar");
  const events = result.events as Array<Record<string, unknown>>;
  assert.equal(events.length, 2);
  assert.equal(events[0].startsAt, "2026-11-09T09:00:00.000Z");
  assert.equal(events[0].endsAt, "2026-11-09T10:00:00.000Z");
  assert.match(String(events[0].summaryHash), /^[0-9a-f]{64}$/);
});

test("calendar adapter rejects an inverted time window", async () => {
  const adapter = createMockCalendarReadAdapter({
    gate: { canRead: () => true },
  });
  await assert.rejects(
    () =>
      adapter(
        {
          timeMin: "2026-11-09T10:00:00.000Z",
          timeMax: "2026-11-09T09:00:00.000Z",
        },
        context,
      ),
    (error: unknown) =>
      error instanceof ToolError && error.code === "invalid_time_window",
  );
});

test("mock adapter map contains exactly the first tool families", () => {
  const adapters = createMockToolAdapters();
  assert.deepEqual(Object.keys(adapters).sort(), [
    toolAdapterKey("calendar.events.read", "1.0.0"),
    toolAdapterKey("web.research.search", "1.0.0"),
    toolAdapterKey("workspace.file.read", "1.0.0"),
  ]);
});
