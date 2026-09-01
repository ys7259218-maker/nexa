import assert from "node:assert/strict";
import test from "node:test";
import { createIssueReport, ISSUE_DESCRIPTION_MAX_LENGTH, ISSUE_TITLE_MAX_LENGTH, listIssueReports, validateIssueReportInput } from "./issueReports.ts";

const workspaceId = "123e4567-e89b-42d3-a456-426614174000";
function fake(result: unknown) {
  const calls: [string, ...unknown[]][] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "order"]) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  chain.limit = async (...args) => { calls.push(["limit", ...args]); return result; };
  return { calls, client: { rpc: async (...args: unknown[]) => { calls.push(["rpc", ...args]); return result; }, from: (...args: unknown[]) => { calls.push(["from", ...args]); return chain; } } as never };
}
test("issue report validation is strict and bounded", () => {
  assert.equal(validateIssueReportInput({ category: "bug", title: "Broken form", description: "The form does not save." }), null);
  assert.match(validateIssueReportInput({ category: "bug", title: "x", description: "long enough description" })!, /Title/);
  assert.match(validateIssueReportInput({ category: "bug", title: "Valid", description: "short" })!, /Description/);
  assert.match(validateIssueReportInput({ category: "other" as "bug", title: "x".repeat(ISSUE_TITLE_MAX_LENGTH + 1), description: "x".repeat(ISSUE_DESCRIPTION_MAX_LENGTH + 1) })!, /Title/);
});
test("creation normalizes input and uses only the guarded RPC", async () => {
  const report = { id: "r", status: "submitted" };
  const f = fake({ data: report, error: null });
  assert.deepEqual(await createIssueReport(f.client, workspaceId, { category: "privacy", title: "  Privacy   concern ", description: "  Please   review this behavior. " }), { data: report, error: null });
  assert.equal(f.calls[0][0], "rpc");
  assert.deepEqual((f.calls[0][2] as { report_title: string }).report_title, "Privacy concern");
});
test("provider failures are generic and invalid requests make no call", async () => {
  const f = fake({ data: null, error: { message: "token stack trace secret" } });
  assert.deepEqual(await createIssueReport(f.client, workspaceId, { category: "safety", title: "Safety issue", description: "This needs a careful review." }), { data: null, error: "Could not submit this issue report. Please try again later." });
  const invalid = fake({ data: [], error: null });
  assert.match((await listIssueReports(invalid.client, "bad")).error!, /Invalid/);
  assert.equal(invalid.calls.length, 0);
});
