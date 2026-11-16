import assert from "node:assert/strict";
import test from "node:test";
import {
  checkDownloadDestination,
  checkUploadSource,
  createApprovalGate,
  describeBrowserApproval,
  type BrowserApprovalResolver,
} from "./approvalGate.ts";
import { createInMemoryEvidenceStore } from "./evidence.ts";
import { createMockDriver } from "./mockDriver.ts";
import { createSessionPolicy } from "./sessionPolicy.ts";
import { createBrowserService } from "./browserService.ts";

const WORKSPACE = "ws-1";
const TASK = "task-1";
const TARGET = "https://example.com/form";

let now = new Date("2026-11-16T10:00:00Z");
function clock() {
  return now;
}
function advance(ms: number) {
  now = new Date(now.getTime() + ms);
}

function gateWith(resolver: BrowserApprovalResolver, ttlMs = 120_000) {
  return createApprovalGate({ resolver, clock, ttlMs });
}

function serviceWith(resolver: BrowserApprovalResolver) {
  const driver = createMockDriver();
  const evidence = createInMemoryEvidenceStore();
  const gate = gateWith(resolver);
  const service = createBrowserService({
    driver,
    policy: createSessionPolicy({ workspaceId: WORKSPACE, allowList: ["example.com"] }),
    evidenceStore: evidence,
    approvalGate: gate,
    clock,
  });
  return { driver, evidence, gate, service };
}

async function tokenFor(
  gate: ReturnType<typeof gateWith>,
  action: "submit" | "upload" | "download",
  targetUrl = TARGET,
  sessionId = "bs_0000000000000000",
) {
  const result = await gate.request({ workspaceId: WORKSPACE, sessionId, action, targetUrl });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

test("AP-01 a submit without approval is blocked before any driver call", async () => {
  const { service, driver, evidence } = serviceWith(() => "approved");
  const opened = await service.openSession({ workspaceId: WORKSPACE, taskId: TASK });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;

  const result = await service.act(opened.value.sessionId, {
    action: "submit",
    targetUrl: TARGET,
    selector: "#go",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "missing_approval");
  assert.deepEqual(driver.calls, []);
  assert.equal((await evidence.listByTask(TASK))?.length, 0);
});

test("AP-02 an approval denied by the user is surfaced as a typed failure", async () => {
  const gate = gateWith(() => "denied");
  const result = await gate.request({
    workspaceId: WORKSPACE,
    sessionId: "bs_0000000000000000",
    action: "submit",
    targetUrl: TARGET,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "approval_denied");
});

test("AP-03 an expired or revoked approval is blocked before execution", async () => {
  const gate = gateWith(() => "approved", 1_000);
  const token = await tokenFor(gate, "submit");
  advance(1_001);
  const expired = gate.verify(token, {
    sessionId: "bs_0000000000000000",
    action: "submit",
    targetUrl: TARGET,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, "approval_expired");

  const freshGate = gateWith(() => "approved");
  const fresh = await tokenFor(freshGate, "submit");
  freshGate.revoke(fresh.tokenId);
  const revoked = freshGate.verify(fresh, {
    sessionId: "bs_0000000000000000",
    action: "submit",
    targetUrl: TARGET,
  });
  assert.equal(revoked.ok, false);
  if (!revoked.ok) assert.equal(revoked.reason, "approval_revoked");
});

test("AP-04 an approval for URL A never authorises URL B", async () => {
  const gate = gateWith(() => "approved");
  const token = await tokenFor(gate, "submit", "https://example.com/a");
  const mismatch = gate.verify(token, {
    sessionId: "bs_0000000000000000",
    action: "submit",
    targetUrl: "https://example.com/b",
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.reason, "target_mismatch");

  const wrongAction = gate.verify(token, {
    sessionId: "bs_0000000000000000",
    action: "download",
    targetUrl: "https://example.com/a",
  });
  assert.equal(wrongAction.ok, false);
  if (!wrongAction.ok) assert.equal(wrongAction.reason, "target_mismatch");
});

test("AP-05 the approval prompt shows the exact target and a plain-language action", () => {
  assert.equal(
    describeBrowserApproval({ action: "submit", targetUrl: TARGET }),
    "Approve: submit the form on https://example.com/form",
  );
  assert.equal(
    describeBrowserApproval({ action: "upload", targetUrl: TARGET }),
    "Approve: upload the selected file on https://example.com/form",
  );
  assert.equal(
    describeBrowserApproval({ action: "download", targetUrl: TARGET }),
    "Approve: download the file on https://example.com/form",
  );
});

test("AP-06 an upload sourced outside tenant staging is blocked before transfer", async () => {
  const { service, driver, gate } = serviceWith(() => "approved");
  const opened = await service.openSession({ workspaceId: WORKSPACE, taskId: TASK });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const token = await tokenFor(gate, "upload", TARGET, opened.value.sessionId);

  const result = await service.act(opened.value.sessionId, {
    action: "upload",
    targetUrl: TARGET,
    selector: "#file",
    stagedFile: "C:\\Users\\Asus\\secret.pdf",
    approvalToken: token,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "upload_source_not_staged");
  assert.equal(driver.calls.some((call) => call.startsWith("perform:")), false);

  const outside = checkUploadSource("sandbox://staging/ws-1/file.pdf", WORKSPACE);
  assert.equal(outside.ok, false);
});

test("AP-07 a download to the host filesystem is refused; sandbox only", async () => {
  const { service, driver, gate } = serviceWith(() => "approved");
  const opened = await service.openSession({ workspaceId: WORKSPACE, taskId: TASK });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const token = await tokenFor(gate, "download", TARGET, opened.value.sessionId);

  const result = await service.act(opened.value.sessionId, {
    action: "download",
    targetUrl: TARGET,
    sandboxPath: "C:\\Users\\Asus\\Downloads\\report.pdf",
    approvalToken: token,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "download_destination_not_sandbox");
  assert.equal(driver.calls.some((call) => call.startsWith("perform:")), false);

  assert.equal(checkDownloadDestination("staging://ws-1/report.pdf", WORKSPACE).ok, false);
  assert.equal(checkDownloadDestination("sandbox://ws-1/report.pdf", WORKSPACE).ok, true);
});

test("AP-08 an approval store error fails closed and never default-allows", async () => {
  const gate = gateWith(() => {
    throw new Error("store unavailable");
  });
  const result = await gate.request({
    workspaceId: WORKSPACE,
    sessionId: "bs_0000000000000000",
    action: "submit",
    targetUrl: TARGET,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "approval_store_error");
});
