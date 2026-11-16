import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BrowserDriverError,
  type BrowserDriver,
} from "./types.ts";
import { createMockDriver } from "./mockDriver.ts";
import { createPlaywrightDriver } from "./playwrightDriver.ts";
import { createInMemoryEvidenceStore } from "./evidence.ts";
import { createApprovalGate } from "./approvalGate.ts";
import { createSessionPolicy } from "./sessionPolicy.ts";
import {
  createBrowserService,
  selectBrowserDriver,
  type BrowserAuditEvent,
  type BrowserServiceDeps,
} from "./browserService.ts";

const WORKSPACE = "ws-1";
const TASK = "task-1";
const TARGET = "https://example.com/form";
const ALLOW = ["example.com"];

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20261116010000_agent_browser_sessions_b7.sql",
    import.meta.url,
  ),
  "utf8",
);

function harness(options: {
  ttlMs?: number;
  idleMs?: number;
  driver?: BrowserDriver;
  beforePerform?: (() => Promise<void>) | null;
}) {
  let now = new Date("2026-11-16T10:00:00Z");
  const clock = () => now;
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  const driver = options.driver ?? createMockDriver();
  if (driver.kind === "mock" && options.beforePerform !== undefined) {
    (driver as ReturnType<typeof createMockDriver>).control.beforePerform =
      options.beforePerform;
  }
  const evidence = createInMemoryEvidenceStore();
  const gate = createApprovalGate({ resolver: () => "approved", clock });
  const audit: BrowserAuditEvent[] = [];
  const deps: BrowserServiceDeps = {
    driver,
    policy: createSessionPolicy({ workspaceId: WORKSPACE, allowList: ALLOW }),
    evidenceStore: evidence,
    approvalGate: gate,
    clock,
    ttlMs: options.ttlMs,
    idleMs: options.idleMs,
    audit: (event) => audit.push(event),
  };
  const service = createBrowserService(deps);
  return { service, driver, gate, audit, advance };
}

async function open(harnessed: ReturnType<typeof harness>) {
  const opened = await harnessed.service.openSession({
    workspaceId: WORKSPACE,
    taskId: TASK,
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.value;
}

async function submitToken(
  harnessed: ReturnType<typeof harness>,
  sessionId: string,
) {
  const result = await harnessed.gate.request({
    workspaceId: WORKSPACE,
    sessionId,
    action: "submit",
    targetUrl: TARGET,
  });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

test("SL-01 the TTL closes the driver, wipes the profile and ends the session", async () => {
  const harnessed = harness({ ttlMs: 1_000, idleMs: 120_000 });
  const session = await open(harnessed);
  harnessed.advance(1_001);

  const result = await harnessed.service.inspect(session.sessionId, { targetUrl: TARGET });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "session_expired");

  const after = harnessed.service.getSession(session.sessionId);
  assert.equal(after?.state, "ended");
  assert.equal(after?.teardownStatus, "aborted");
  assert.equal(after?.expiresAt, "2026-11-16T10:00:01.000Z");
  assert.equal((harnessed.driver as ReturnType<typeof createMockDriver>).closed, true);
  assert.equal(harnessed.driver.profileFileCount(), 0);
  assert.ok(harnessed.audit.some((event) => event.kind === "session_ended"));
});

test("SL-02 the idle timeout closes the session exactly like the TTL", async () => {
  const harnessed = harness({ ttlMs: 600_000, idleMs: 500 });
  const session = await open(harnessed);
  harnessed.advance(600);

  const result = await harnessed.service.inspect(session.sessionId, { targetUrl: TARGET });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "session_expired");

  const after = harnessed.service.getSession(session.sessionId);
  assert.equal(after?.state, "ended");
  assert.equal(after?.teardownStatus, "aborted");
  assert.equal((harnessed.driver as ReturnType<typeof createMockDriver>).closed, true);
});

test("SL-03 a kill switch during an action aborts, ends and audits the session", async () => {
  let harnessed: ReturnType<typeof harness> | null = null;
  const sessionRef: { id: string } = { id: "" };
  const driver = createMockDriver();
  driver.control.beforePerform = async () => {
    harnessed?.service.killSwitch(sessionRef.id, "owner pressed stop");
  };
  harnessed = harness({ driver });

  const session = await open(harnessed);
  sessionRef.id = session.sessionId;
  const token = await submitToken(harnessed, session.sessionId);

  const result = await harnessed.service.act(session.sessionId, {
    action: "submit",
    targetUrl: TARGET,
    selector: "#go",
    approvalToken: token,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "session_aborted");

  const after = harnessed.service.getSession(session.sessionId);
  assert.equal(after?.state, "ended");
  assert.equal(after?.teardownStatus, "aborted");
  assert.equal(after?.abortReason, "owner pressed stop");
  assert.ok(harnessed.audit.some((event) => event.kind === "session_aborted"));
  assert.ok(
    harnessed.audit.some(
      (event) => event.kind === "session_ended" && event.detail === "owner pressed stop",
    ),
  );
});

test("SL-04 a partial teardown is reported as teardown_failed, never closed", async () => {
  const driver = createMockDriver();
  driver.control.teardownFails = true;
  const harnessed = harness({ driver });
  const session = await open(harnessed);

  const result = await harnessed.service.closeSession(session.sessionId);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.teardownStatus, "teardown_failed");
  assert.equal(harnessed.service.getSession(session.sessionId)?.teardownStatus, "teardown_failed");
  assert.ok(harnessed.audit.some((event) => event.kind === "teardown_failed"));
});

test("SL-05 a clean teardown leaves zero profile files; remnants fail the close", async () => {
  const clean = harness({});
  const cleanSession = await open(clean);
  const closed = await clean.service.closeSession(cleanSession.sessionId);
  assert.equal(closed.ok, true);
  if (closed.ok) {
    assert.equal(closed.value.teardownStatus, "closed");
    assert.equal(closed.value.profileFiles, 0);
  }

  const driver = createMockDriver();
  driver.control.wipeLeavesFile = true;
  const dirty = harness({ driver });
  const dirtySession = await open(dirty);
  const failed = await dirty.service.closeSession(dirtySession.sessionId);
  assert.equal(failed.ok, true);
  if (failed.ok) {
    assert.equal(failed.value.teardownStatus, "teardown_failed");
    assert.equal(failed.value.profileFiles, 1);
  }
});

test("SL-06 the session table is workspace-scoped, append-only and has no cross-workspace read", () => {
  assert.match(migration, /create table if not exists public\.agent_browser_sessions/);
  assert.match(migration, /workspace_id uuid not null references public\.workspaces\(id\) on delete cascade/);
  assert.match(migration, /constraint agent_browser_sessions_workspace_ref_key unique/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /for select to authenticated/);
  assert.match(migration, /using \(public\.is_workspace_member\(workspace_id\)\)/);
  assert.doesNotMatch(migration, /for insert|for update|for delete/i);
  assert.doesNotMatch(migration, /alter table public\.(?!agent_browser_)/i);
});

test("DG-01 the default driver is the offline mock and opens zero sockets", async () => {
  const driver = selectBrowserDriver({ NODE_ENV: "test" });
  assert.equal(driver.kind, "mock");
  assert.equal(driver.socketsOpened(), 0);
  await driver.open("https://example.com/");
  assert.equal(driver.socketsOpened(), 0);

  const explicitMock = selectBrowserDriver({ BROWSER_DRIVER: "mock" });
  assert.equal(explicitMock.kind, "mock");
});

test("DG-02 playwright without binaries fails with a typed error and no install attempt", async () => {
  const driver = createPlaywrightDriver({
    loader: async () => {
      throw new Error("package not installed");
    },
  });
  assert.equal(driver.installAttempts, 0);
  await assert.rejects(
    () => driver.open("https://example.com/"),
    (error: unknown) =>
      error instanceof BrowserDriverError && error.code === "browser_unavailable",
  );
  assert.equal(driver.installAttempts, 0);

  const selected = selectBrowserDriver({ BROWSER_DRIVER: "playwright" });
  assert.equal(selected.kind, "playwright");
  await assert.rejects(
    () => selected.open("https://example.com/"),
    (error: unknown) =>
      error instanceof BrowserDriverError && error.code === "browser_unavailable",
  );
  assert.equal(
    (selected as BrowserDriver & { installAttempts: number }).installAttempts,
    0,
  );
});

test("DG-03 the unit suite never launches a real browser or installs one", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  ) as { scripts: Record<string, string> };
  const unitTestScript = packageJson.scripts.test ?? "";

  assert.doesNotMatch(unitTestScript, /playwright\s+install/i);
  assert.doesNotMatch(unitTestScript, /@playwright\/test/);
  assert.doesNotMatch(unitTestScript, /\.spec\./);
  assert.match(unitTestScript, /^node --test lib\//);

  const mock = createMockDriver();
  assert.equal(mock.installAttempts, 0);
  assert.equal(mock.socketsOpened(), 0);
});
