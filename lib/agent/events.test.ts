import assert from "node:assert/strict";
import test from "node:test";

import {
  abortableSleep,
  formatSseComment,
  formatSseEvent,
  formatSseRetry,
  parseLastEventId,
} from "./events.ts";
import type { AgentEvent } from "./types.ts";

const event: AgentEvent = {
  id: "evt-1",
  workspaceId: "workspace-1",
  taskId: "task-1",
  seq: 7,
  type: "step_succeeded",
  payload: { step_id: "step-1", seq: 1, status: "SUCCEEDED" },
  createdAt: "2026-11-08T00:00:07.000Z",
};

test("parseLastEventId accepts only non-negative safe integers", () => {
  assert.equal(parseLastEventId(null), 0);
  assert.equal(parseLastEventId(undefined), 0);
  assert.equal(parseLastEventId(""), 0);
  assert.equal(parseLastEventId("0"), 0);
  assert.equal(parseLastEventId("7"), 7);
  assert.equal(parseLastEventId(" 12 "), 12);
  assert.equal(parseLastEventId("-1"), 0);
  assert.equal(parseLastEventId("1.5"), 0);
  assert.equal(parseLastEventId("abc"), 0);
  assert.equal(parseLastEventId("9007199254740992"), 0);
});

test("SSE events are framed with a sequence id, type, and single-line JSON data", () => {
  const frame = formatSseEvent(event);

  assert.ok(frame.startsWith("id: 7\nevent: step_succeeded\ndata: "));
  assert.ok(frame.endsWith("\n\n"));
  assert.equal(frame.match(/\ndata: /g)?.length, 1);

  const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
  assert.ok(dataLine);
  const parsed = JSON.parse(dataLine.slice("data: ".length)) as Record<string, unknown>;
  assert.equal(parsed.id, "evt-1");
  assert.equal(parsed.task_id, "task-1");
  assert.equal(parsed.seq, 7);
  assert.equal(parsed.type, "step_succeeded");
  assert.deepEqual(parsed.payload, event.payload);
  assert.equal(parsed.created_at, event.createdAt);
});

test("SSE retry and comment frames are bounded and cannot inject lines", () => {
  assert.equal(formatSseRetry(3_000), "retry: 3000\n\n");
  assert.equal(formatSseRetry(-5), "retry: 0\n\n");
  assert.equal(formatSseRetry(120_000), "retry: 60000\n\n");

  assert.equal(formatSseComment("keep-alive"), ": keep-alive\n\n");
  assert.equal(formatSseComment("line one\r\nline two"), ": line one line two\n\n");
  assert.equal(formatSseComment("x".repeat(500)).length, 2 + 200 + 2);
});

test("abortableSleep resolves on abort and does not wait for the timer", async () => {
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  const started = Date.now();
  await abortableSleep(60_000, alreadyAborted.signal);
  assert.ok(Date.now() - started < 1_000);

  const duringSleep = new AbortController();
  const pending = abortableSleep(60_000, duringSleep.signal);
  duringSleep.abort();
  await pending;

  const completed = Date.now();
  await abortableSleep(10);
  assert.ok(Date.now() - completed >= 5);
});
