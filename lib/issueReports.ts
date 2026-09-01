import type { SupabaseClient } from "@supabase/supabase-js";

export const ISSUE_REPORT_CATEGORIES = ["bug", "usability", "privacy", "security", "other"] as const;
export type IssueReportCategory = (typeof ISSUE_REPORT_CATEGORIES)[number];
export type IssueReport = { id: string; workspace_id: string; reporter_user_id: string; category: IssueReportCategory; title: string; description: string; created_at: string };
export type IssueReportInput = { category: IssueReportCategory; title: string; description: string };
export const ISSUE_REPORT_TITLE_MIN_LENGTH = 5;
export const ISSUE_REPORT_TITLE_MAX_LENGTH = 120;
export const ISSUE_REPORT_DESCRIPTION_MIN_LENGTH = 20;
export const ISSUE_REPORT_DESCRIPTION_MAX_LENGTH = 4_000;

function normalizeText(value: unknown): string { return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : ""; }

export function validateIssueReportInput(input: IssueReportInput): string | null {
  if (!ISSUE_REPORT_CATEGORIES.includes(input.category)) return "Choose a valid issue category.";
  const title = normalizeText(input.title);
  if (title.length < ISSUE_REPORT_TITLE_MIN_LENGTH || title.length > ISSUE_REPORT_TITLE_MAX_LENGTH) return `Title must be ${ISSUE_REPORT_TITLE_MIN_LENGTH}–${ISSUE_REPORT_TITLE_MAX_LENGTH} characters.`;
  const description = normalizeText(input.description);
  if (description.length < ISSUE_REPORT_DESCRIPTION_MIN_LENGTH || description.length > ISSUE_REPORT_DESCRIPTION_MAX_LENGTH) return `Description must be ${ISSUE_REPORT_DESCRIPTION_MIN_LENGTH}–${ISSUE_REPORT_DESCRIPTION_MAX_LENGTH} characters.`;
  return null;
}

export async function listIssueReports(client: SupabaseClient, workspaceId: string, limit = 50): Promise<{ data: IssueReport[]; error: string | null }> {
  if (!workspaceId || limit < 1 || limit > 50) return { data: [], error: "Invalid issue report request." };
  const { data, error } = await client.from("issue_reports").select("id,workspace_id,reporter_user_id,category,title,description,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit);
  return error ? { data: [], error: "Could not load issue reports. Please try again later." } : { data: (data ?? []) as IssueReport[], error: null };
}

export async function createIssueReport(client: SupabaseClient, workspaceId: string, input: IssueReportInput): Promise<{ data: IssueReport | null; error: string | null }> {
  const validationError = validateIssueReportInput(input);
  if (!workspaceId || validationError) return { data: null, error: validationError ?? "Invalid workspace." };
  const { data, error } = await client.rpc("create_issue_report", { target_workspace_id: workspaceId, report_category: input.category, report_title: normalizeText(input.title), report_description: normalizeText(input.description) });
  return error ? { data: null, error: "Could not submit this report. Please try again later." } : { data: data as IssueReport, error: null };
}
