import assert from "node:assert/strict";
import test from "node:test";
import { runIndependentCleanups, type CleanupTask } from "./cleanupTasks.ts";

function okTask(name: string): CleanupTask {
  return { name, run: async () => true };
}

function failingTask(name: string): CleanupTask {
  return { name, run: async () => false };
}

function throwingTask(name: string): CleanupTask {
  return { name, run: async () => { throw new Error("provider exploded"); } };
}

test("every cleanup task is attempted even when an earlier one fails", async () => {
  const order: string[] = [];
  const tasks: CleanupTask[] = [
    { name: "first", run: async () => { order.push("first"); return false; } },
    { name: "second", run: async () => { order.push("second"); return true; } },
    { name: "third", run: async () => { order.push("third"); return true; } },
  ];
  const failures = await runIndependentCleanups(tasks);
  assert.deepEqual(failures, ["first"]);
  assert.deepEqual(order, ["first", "second", "third"]);
});

test("failures from every task are collected instead of short-circuiting", async () => {
  const failures = await runIndependentCleanups([
    failingTask("report cleanup"),
    okTask("employee cleanup"),
    throwingTask("throwing cleanup"),
    okTask("another cleanup"),
  ]);
  assert.deepEqual(failures, ["report cleanup", "throwing cleanup"]);
});

test("no tasks produces no failures", async () => {
  assert.deepEqual(await runIndependentCleanups([]), []);
});

test("a thrown exception is reported as a failure without leaking provider details", async () => {
  const failures = await runIndependentCleanups([throwingTask("throwing cleanup")]);
  assert.deepEqual(failures, ["throwing cleanup"]);
  assert.ok(failures.every((f) => !/exploded|provider/i.test(f)));
});