import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeSourceKind = "website" | "file";
export type KnowledgeFileMediaType = "application/pdf" | "text/plain";

export type KnowledgeSource = {
  id: string;
  workspace_id: string;
  ai_employee_id: string;
  kind: KnowledgeSourceKind;
  label: string;
  website_url: string;
  file_name: string;
  file_media_type: string;
  file_size_bytes: number | null;
  created_by: string;
  created_at: string;
  reviewed_at: string | null;
  review_due_at: string | null;
  reviewed_by: string | null;
};

export type KnowledgeSourceDeletionReceipt = {
  id: string;
  workspace_id: string;
  ai_employee_id: string;
  knowledge_source_id: string;
  source_kind: KnowledgeSourceKind;
  deleted_by: string | null;
  deleted_at: string;
};

export type KnowledgeSourceInput = {
  kind: KnowledgeSourceKind;
  label: string;
  websiteUrl?: string;
  fileName?: string;
  fileMediaType?: KnowledgeFileMediaType | "";
  fileSizeBytes?: number | null;
};

export const KNOWLEDGE_SOURCE_LABEL_MAX_LENGTH = 120;
export const KNOWLEDGE_SOURCE_URL_MAX_LENGTH = 2_048;
export const KNOWLEDGE_SOURCE_FILE_NAME_MAX_LENGTH = 255;
export const KNOWLEDGE_SOURCE_FILE_MAX_BYTES = 25 * 1024 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function isValidKnowledgeSourceId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 36 && UUID_PATTERN.test(value);
}

export function normalizePublicHttpsUrl(value: string | undefined): string | null {
  const cleaned = clean(value);
  if (!cleaned || cleaned.length > KNOWLEDGE_SOURCE_URL_MAX_LENGTH) return null;

  try {
    const url = new URL(cleaned);
    const hostname = url.hostname.toLocaleLowerCase("en");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port && url.port !== "443" ||
      url.hash ||
      !DOMAIN_PATTERN.test(hostname) ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".localhost")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function validateKnowledgeSourceInput(input: KnowledgeSourceInput): string | null {
  if (input.kind !== "website" && input.kind !== "file") return "Choose a valid source type.";

  const label = clean(input.label);
  if (!label) return "Source label is required.";
  if (label.length > KNOWLEDGE_SOURCE_LABEL_MAX_LENGTH) {
    return `Source label must be at most ${KNOWLEDGE_SOURCE_LABEL_MAX_LENGTH} characters.`;
  }

  if (input.kind === "website") {
    if (!normalizePublicHttpsUrl(input.websiteUrl)) {
      return "Enter a public HTTPS website URL without credentials, fragments, custom ports, or private hostnames.";
    }
    return null;
  }

  const fileName = clean(input.fileName);
  if (!fileName) return "File name is required.";
  if (
    fileName.length > KNOWLEDGE_SOURCE_FILE_NAME_MAX_LENGTH ||
    /[\\/\u0000-\u001f\u007f]/.test(fileName) ||
    fileName === "." ||
    fileName === ".."
  ) {
    return "Enter a plain file name of at most 255 characters without a path or control characters.";
  }

  const mediaType = input.fileMediaType;
  const extension = fileName.toLocaleLowerCase("en").split(".").pop();
  if (
    (mediaType !== "application/pdf" || extension !== "pdf") &&
    (mediaType !== "text/plain" || extension !== "txt")
  ) {
    return "File metadata must describe a matching PDF (.pdf) or plain-text (.txt) file.";
  }

  if (
    !Number.isSafeInteger(input.fileSizeBytes) ||
    (input.fileSizeBytes ?? 0) < 1 ||
    (input.fileSizeBytes ?? 0) > KNOWLEDGE_SOURCE_FILE_MAX_BYTES
  ) {
    return `File size metadata must be between 1 byte and ${KNOWLEDGE_SOURCE_FILE_MAX_BYTES} bytes.`;
  }

  return null;
}

function normalizedInput(input: KnowledgeSourceInput) {
  if (input.kind === "website") {
    return {
      source_kind: "website" as const,
      source_label: clean(input.label),
      source_website_url: normalizePublicHttpsUrl(input.websiteUrl)!,
      source_file_name: "",
      source_file_media_type: "",
      source_file_size_bytes: null,
    };
  }

  return {
    source_kind: "file" as const,
    source_label: clean(input.label),
    source_website_url: "",
    source_file_name: clean(input.fileName),
    source_file_media_type: input.fileMediaType!,
    source_file_size_bytes: input.fileSizeBytes!,
  };
}

export async function listKnowledgeSources(
  client: SupabaseClient,
  employeeId: string,
  limit = 50,
): Promise<{ data: KnowledgeSource[]; error: string | null }> {
  if (!isValidKnowledgeSourceId(employeeId) || limit < 1 || limit > 50) {
    return { data: [], error: "Invalid source registry request." };
  }

  const { data, error } = await client
    .from("knowledge_sources")
    .select("id,workspace_id,ai_employee_id,kind,label,website_url,file_name,file_media_type,file_size_bytes,created_by,created_at,reviewed_at,review_due_at,reviewed_by")
    .eq("ai_employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: "Could not load knowledge source references." };
  return { data: (data ?? []) as KnowledgeSource[], error: null };
}

export async function createKnowledgeSource(
  client: SupabaseClient,
  employeeId: string,
  input: KnowledgeSourceInput,
): Promise<{ data: KnowledgeSource | null; error: string | null }> {
  if (!isValidKnowledgeSourceId(employeeId)) return { data: null, error: "Invalid AI Employee." };
  const validationError = validateKnowledgeSourceInput(input);
  if (validationError) return { data: null, error: validationError };

  const { data, error } = await client.rpc("create_knowledge_source", {
    target_employee_id: employeeId,
    ...normalizedInput(input),
  });
  if (error) return { data: null, error: "Could not add this source reference." };
  return { data: data as KnowledgeSource, error: null };
}

export async function deleteKnowledgeSource(
  client: SupabaseClient,
  employeeId: string,
  sourceId: string,
): Promise<{ data: KnowledgeSourceDeletionReceipt | null; error: string | null }> {
  if (!isValidKnowledgeSourceId(employeeId) || !isValidKnowledgeSourceId(sourceId)) {
    return { data: null, error: "Invalid source reference." };
  }
  const { data, error } = await client.rpc("delete_knowledge_source", {
    target_employee_id: employeeId,
    target_source_id: sourceId,
  });
  return { data: error ? null : data as KnowledgeSourceDeletionReceipt, error: error ? "Could not delete this source reference." : null };
}

export async function markKnowledgeSourceReviewed(
  client: SupabaseClient,
  employeeId: string,
  sourceId: string,
  reviewDueDays: number,
): Promise<{ data: KnowledgeSource | null; error: string | null }> {
  if (!isValidKnowledgeSourceId(employeeId) || !isValidKnowledgeSourceId(sourceId) ||
      !Number.isInteger(reviewDueDays) || reviewDueDays < 1 || reviewDueDays > 365) {
    return { data: null, error: "Choose a review interval from 1 through 365 days." };
  }
  const { data, error } = await client.rpc("mark_knowledge_source_reviewed", {
    target_employee_id: employeeId,
    target_source_id: sourceId,
    review_due_days: reviewDueDays,
  });
  return { data: error ? null : data as KnowledgeSource, error: error ? "Could not record this manual review." : null };
}

export async function listKnowledgeSourceDeletionReceipts(
  client: SupabaseClient,
  employeeId: string,
  limit = 20,
): Promise<{ data: KnowledgeSourceDeletionReceipt[]; error: string | null }> {
  if (!isValidKnowledgeSourceId(employeeId) || limit < 1 || limit > 20) return { data: [], error: "Invalid deletion receipt request." };
  const { data, error } = await client.from("knowledge_source_deletion_receipts")
    .select("id,workspace_id,ai_employee_id,knowledge_source_id,source_kind,deleted_by,deleted_at")
    .eq("ai_employee_id", employeeId).order("deleted_at", { ascending: false }).limit(limit);
  return { data: error ? [] : (data ?? []) as KnowledgeSourceDeletionReceipt[], error: error ? "Could not load deletion receipts." : null };
}
