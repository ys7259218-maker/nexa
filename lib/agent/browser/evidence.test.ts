import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildEvidenceDescriptor,
  captureEvidence,
  createInMemoryEvidenceStore,
  deleteTaskEvidence,
  hashBytes,
  type EvidenceStore,
} from "./evidence.ts";
import { createApprovalGate } from "./approvalGate.ts";
import { createMockDriver } from "./mockDriver.ts";
import { createSessionPolicy } from "./sessionPolicy.ts";
import { createBrowserService } from "./browserService.ts";

const WORKSPACE = "ws-1";
const TASK = "task-1";
const TARGET = "https://example.com/form";
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20261116010000_agent_browser_sessions_b7.sql",
    import.meta.url,
  ),
  "utf8",
);

const fixedClock = () => new Date("2026-11-16T10:00:00Z");

test("EV-01 an approved action records before/after descriptors with URL, time and hashes", async () => {
  const driver = createMockDriver();
  const evidence = createInMemoryEvidenceStore();
  const gate = createApprovalGate({ resolver: () => "approved", clock: fixedClock });
  const service = createBrowserService({
    driver,
    policy: createSessionPolicy({ workspaceId: WORKSPACE, allowList: ["example.com"] }),
    evidenceStore: evidence,
    approvalGate: gate,
    clock: fixedClock,
  });

  const opened = await service.openSession({ workspaceId: WORKSPACE, taskId: TASK });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;

  const token = await gate.request({
    workspaceId: WORKSPACE,
    sessionId: opened.value.sessionId,
    action: "submit",
    targetUrl: TARGET,
  });
  assert.equal(token.ok, true);
  if (!token.ok) return;

  const result = await service.act(opened.value.sessionId, {
    action: "submit",
    targetUrl: TARGET,
    selector: "#go",
    approvalToken: token.value,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.evidence.length, 2);

  const descriptors = await evidence.listByTask(TASK);
  assert.equal(descriptors?.length, 2);
  const [before, after] = descriptors ?? [];
  assert.equal(before?.phase, "before");
  assert.equal(after?.phase, "after");
  for (const descriptor of [before, after]) {
    assert.equal(descriptor?.url, TARGET);
    assert.match(descriptor?.capturedAt ?? "", /^2026-11-16T10:00:00\.000Z$/);
    assert.match(descriptor?.screenshotHash ?? "", /^[0-9a-f]{64}$/);
    assert.match(descriptor?.domHash ?? "", /^[0-9a-f]{64}$/);
    assert.match(descriptor?.pointer ?? "", /^sandbox:\/\/evidence\/ws-1\/task-1\//);
  }
});

test("EV-02 a failed descriptor write fails the action and never claims success", async () => {
  const driver = createMockDriver();
  const failingStore: EvidenceStore = {
    async put() {
      return { ok: false, reason: "sandbox_full" };
    },
    async listByTask() {
      return [];
    },
    async deleteByTask() {
      return { ok: true, deleted: 0 };
    },
  };
  const gate = createApprovalGate({ resolver: () => "approved", clock: fixedClock });
  const service = createBrowserService({
    driver,
    policy: createSessionPolicy({ workspaceId: WORKSPACE, allowList: ["example.com"] }),
    evidenceStore: failingStore,
    approvalGate: gate,
    clock: fixedClock,
  });

  const opened = await service.openSession({ workspaceId: WORKSPACE, taskId: TASK });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const token = await gate.request({
    workspaceId: WORKSPACE,
    sessionId: opened.value.sessionId,
    action: "submit",
    targetUrl: TARGET,
  });
  assert.equal(token.ok, true);
  if (!token.ok) return;

  const result = await service.act(opened.value.sessionId, {
    action: "submit",
    targetUrl: TARGET,
    selector: "#go",
    approvalToken: token.value,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "evidence_write_failed");
  assert.equal(driver.calls.some((call) => call.startsWith("perform:")), false);
});

test("EV-03 a large payload stays in sandbox storage; the descriptor is a bounded pointer", async () => {
  const store = createInMemoryEvidenceStore();
  const screenshot = new Uint8Array(64 * 1024).fill(7);
  const dom = new TextEncoder().encode(`<html>${"x".repeat(32 * 1024)}</html>`);
  const input = {
    workspaceId: WORKSPACE,
    taskId: TASK,
    sessionId: "bs_0000000000000000",
    phase: "before" as const,
    url: TARGET,
    capturedAt: "2026-11-16T10:00:00.000Z",
    payload: { screenshot, dom },
  };

  const descriptor = await captureEvidence(store, input);
  const row = JSON.stringify(descriptor);
  assert.ok(Buffer.byteLength(row, "utf8") < 1024, `descriptor was ${row.length} bytes`);
  assert.equal(row.includes("xxxx"), false);
  assert.equal(hashBytes(screenshot), descriptor.screenshotHash);
  assert.equal(hashBytes(dom), descriptor.domHash);
  assert.equal(store.payloadFor(descriptor.pointer)?.screenshot.length, screenshot.length);
});

test("EV-04 task deletion cascades evidence descriptors and sandbox objects", async () => {
  const store = createInMemoryEvidenceStore();
  const base = {
    workspaceId: WORKSPACE,
    taskId: TASK,
    sessionId: "bs_0000000000000000",
    url: TARGET,
    capturedAt: "2026-11-16T10:00:00.000Z",
    payload: {
      screenshot: new TextEncoder().encode("shot"),
      dom: new TextEncoder().encode("<html></html>"),
    },
  };
  await captureEvidence(store, { ...base, phase: "before" });
  await captureEvidence(store, { ...base, phase: "after" });
  assert.equal(store.objectCount(), 2);

  const deleted = await deleteTaskEvidence(store, TASK);
  assert.equal(deleted, 2);
  assert.deepEqual(await store.listByTask(TASK), []);
  assert.equal(store.objectCount(), 0);

  assert.match(
    migration,
    /task_id uuid not null references public\.agent_tasks\(id\) on delete cascade/,
  );
});

test("EV-05 evidence references are workspace-scoped by RLS and store no page content", () => {
  assert.match(migration, /evidence_refs text\[\] not null default '\{\}'/);
  assert.match(migration, /enable row level security/);
  assert.match(
    migration,
    /create policy "Agent browser sessions are readable by workspace members"[\s\S]*?for select to authenticated[\s\S]*?using \(public\.is_workspace_member\(workspace_id\)\)/,
  );
  assert.doesNotMatch(migration, /for insert|for update|for delete/i);
  const sqlWithoutComments = migration
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  assert.doesNotMatch(
    sqlWithoutComments,
    /\b(screenshot|dom_snapshot|page_content|cookies?|credentials?|download_bytes)\b/i,
  );

  const descriptor = buildEvidenceDescriptor({
    workspaceId: WORKSPACE,
    taskId: TASK,
    sessionId: "bs_0000000000000000",
    phase: "after",
    url: TARGET,
    capturedAt: "2026-11-16T10:00:00.000Z",
    payload: {
      screenshot: new TextEncoder().encode("bytes"),
      dom: new TextEncoder().encode("<html></html>"),
    },
  });
  assert.equal(descriptor.workspaceId, WORKSPACE);
  assert.equal(JSON.stringify(descriptor).includes("bytes"), false);
});
