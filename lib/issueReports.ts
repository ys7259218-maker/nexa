import type { SupabaseClient } from "@supabase/supabase-js";

export const ISSUE_CATEGORIES = ["bug", "accessibility", "privacy", "safety", "other"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export type IssueReport = { id: string; workspace_id: string; reporter_id: string; category: IssueCategory; title: string; description: string; status: "submitted"; created_at: string };
export type IssueReportInput = { category: IssueCategory; title: string; description: string };
export const ISSUE_TITLE_MAX_LENGTH = 120;
export const ISSUE_DESCRIPTION_MAX_LENGTH = 2000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalize(value: string) { return value.replace(/\s+/g, " ").trim(); }
export function isValidIssueWorkspaceId(value: unknown): value is string { return typeof value === "string" && UUID_PATTERN.test(value); }
export function validateIssueReportInput(input: IssueReportInput): string | null {
  if (!ISSUE_CATEGORIES.includes(input.category)) return "Choose a valid issue category.";
  const title = normalize(input.title);
  const description = normalize(input.description);
  if (title.length < 3 || title.length > ISSUE_TITLE_MAX_LENGTH) return "Title must be between 3 and 120 characters.";
  if (description.length < 10 || description.length > ISSUE_DESCRIPTION_MAX_LENGTH) return "Description must be between 10 and 2,000 characters.";
  return null;
}
export async function createIssueReport(client: SupabaseClient, workspaceId: string, input: IssueReportInput) {
  if (!isValidIssueWorkspaceId(workspaceId)) return { data: null, error: "Invalid workspace." };
  const validationError = validateIssueReportInput(input);
  if (validationError) return { data: null, error: validationError };
  const { data, error } = await client.rpc("create_issue_report", { target_workspace_id: workspaceId, report_category: input.category, report_title: normalize(input.title), report_description: normalize(input.description) });
  return { data: error ? null : data as IssueReport, error: error ? "Could not submit this issue report. Please try again later." : null };
}
export async function listIssueReports(client: SupabaseClient, workspaceId: string, limit = 25) {
  if (!isValidIssueWorkspaceId(workspaceId) || !Number.isInteger(limit) || limit < 1 || limit > 25) return { data: [] as IssueReport[], error: "Invalid issue report request." };
  const { data, error } = await client.from("issue_reports").select("id,workspace_id,reporter_id,category,title,description,status,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit);
  return { data: error ? [] : (data ?? []) as IssueReport[], error: error ? "Could not load issue reports." : null };
}
