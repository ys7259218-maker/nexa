import assert from "node:assert/strict";
import test from "node:test";
import { ISSUE_REPORT_DESCRIPTION_MAX_LENGTH, ISSUE_REPORT_TITLE_MAX_LENGTH, createIssueReport, listIssueReports, validateIssueReportInput } from "./issueReports.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
function fakeClient(result: unknown) {
  const calls: Array<[string, unknown]> = [];
  const builder = { select(value: string) { calls.push(["select", value]); return builder; }, eq(field: string, value: unknown) { calls.push([`eq:${field}`, value]); return builder; }, order(field: string, value: unknown) { calls.push([`order:${field}`, value]); return builder; }, limit: async (value: number) => (calls.push(["limit", value]), result) };
  return { calls, client: { from: (table: string) => (calls.push(["from", table]), builder), rpc: async (name: string, args: unknown) => (calls.push([`rpc:${name}`, args]), result) } as never };
}

test("issue report validation strictly bounds category, title, and description", () => {
  assert.equal(validateIssueReportInput({ category: "bug", title: "Login fails", description: "A synthetic tester cannot sign in." }), null);
  assert.match(validateIssueReportInput({ category: "bug", title: "no", description: "A synthetic tester cannot sign in." })!, /5–120/);
  assert.match(validateIssueReportInput({ category: "bug", title: "x".repeat(ISSUE_REPORT_TITLE_MAX_LENGTH + 1), description: "A synthetic tester cannot sign in." })!, /5–120/);
  assert.match(validateIssueReportInput({ category: "bug", title: "Login fails", description: "short" })!, /20–4000/);
  assert.match(validateIssueReportInput({ category: "bug", title: "Login fails", description: "x".repeat(ISSUE_REPORT_DESCRIPTION_MAX_LENGTH + 1) })!, /20–4000/);
  assert.match(validateIssueReportInput({ category: "token" as "bug", title: "Login fails", description: "A synthetic tester cannot sign in." })!, /valid issue category/);
});

test("creation uses only the guarded RPC and returns provider-safe errors", async () => {
  const row = { id: "22222222-2222-4222-8222-222222222222" };
  const fake = fakeClient({ data: row, error: null });
  assert.deepEqual(await createIssueReport(fake.client, workspaceId, { category: "privacy", title: "  Export wording  ", description: "  Synthetic report description only.  " }), { data: row, error: null });
  assert.deepEqual(fake.calls[0], ["rpc:create_issue_report", { target_workspace_id: workspaceId, report_category: "privacy", report_title: "Export wording", report_description: "Synthetic report description only." }]);
  const failed = fakeClient({ data: null, error: { message: "token=secret stack trace" } });
  const result = await createIssueReport(failed.client, workspaceId, { category: "bug", title: "Synthetic failure", description: "Synthetic report description only." });
  assert.equal(result.error, "Could not submit this report. Please try again later.");
  assert.doesNotMatch(result.error!, /token|stack|secret/i);
});

test("listing is explicitly workspace-scoped and sanitizes database failures", async () => {
  const fake = fakeClient({ data: [], error: null });
  assert.deepEqual(await listIssueReports(fake.client, workspaceId), { data: [], error: null });
  assert.ok(fake.calls.some(([name, value]) => name === "eq:workspace_id" && value === workspaceId));
  const failed = fakeClient({ data: null, error: { message: "provider details" } });
  assert.equal((await listIssueReports(failed.client, workspaceId)).error, "Could not load issue reports. Please try again later.");
});
