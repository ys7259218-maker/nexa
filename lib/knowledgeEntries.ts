import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeEntryKind = "note" | "faq";

export type KnowledgeEntry = {
  id: string;
  workspace_id: string;
  ai_employee_id: string;
  kind: KnowledgeEntryKind;
  title: string;
  question: string;
  content: string;
  verified: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type KnowledgeEntryInput = {
  kind: KnowledgeEntryKind;
  title: string;
  question?: string;
  content: string;
  verified: boolean;
};

export type KnowledgeEntryPatch = Partial<KnowledgeEntryInput>;

export const KNOWLEDGE_TITLE_MAX_LENGTH = 120;
export const KNOWLEDGE_QUESTION_MAX_LENGTH = 500;
export const KNOWLEDGE_CONTENT_MAX_LENGTH = 2_000;
export const KNOWLEDGE_CONTEXT_MAX_LENGTH = 4_000;
export const KNOWLEDGE_ANSWER_MAX_LENGTH = 600;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "can", "do", "for", "how", "i", "in", "is", "it", "of",
  "on", "or", "the", "to", "what", "when", "where", "with", "you", "your",
]);

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function isValidKnowledgeId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 36 && UUID_PATTERN.test(value);
}

export function validateKnowledgeEntryInput(input: KnowledgeEntryInput): string | null {
  if (input.kind !== "note" && input.kind !== "faq") return "Choose a valid knowledge type.";

  const title = clean(input.title);
  const question = clean(input.question);
  const content = clean(input.content);

  if (!title) return "Knowledge title is required.";
  if (title.length > KNOWLEDGE_TITLE_MAX_LENGTH) {
    return `Knowledge title must be at most ${KNOWLEDGE_TITLE_MAX_LENGTH} characters.`;
  }
  if (input.kind === "faq" && !question) return "FAQ question is required.";
  if (question.length > KNOWLEDGE_QUESTION_MAX_LENGTH) {
    return `FAQ question must be at most ${KNOWLEDGE_QUESTION_MAX_LENGTH} characters.`;
  }
  if (!content) return "Knowledge answer or note is required.";
  if (content.length > KNOWLEDGE_CONTENT_MAX_LENGTH) {
    return `Knowledge content must be at most ${KNOWLEDGE_CONTENT_MAX_LENGTH} characters.`;
  }

  return null;
}

function normalizedInput(input: KnowledgeEntryInput) {
  return {
    kind: input.kind,
    title: clean(input.title),
    question: input.kind === "faq" ? clean(input.question) : "",
    content: clean(input.content),
    verified: input.verified === true,
  };
}

export async function listKnowledgeEntries(
  client: SupabaseClient,
  employeeId: string,
  limit = 50,
): Promise<{ data: KnowledgeEntry[]; error: string | null }> {
  if (!isValidKnowledgeId(employeeId) || limit < 1 || limit > 50) {
    return { data: [], error: "Invalid knowledge request." };
  }

  const { data, error } = await client
    .from("knowledge_entries")
    .select("id,workspace_id,ai_employee_id,kind,title,question,content,verified,created_by,updated_by,created_at,updated_at")
    .eq("ai_employee_id", employeeId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: "Could not load structured knowledge." };
  return { data: (data ?? []) as KnowledgeEntry[], error: null };
}

export async function listVerifiedKnowledgeEntries(
  client: SupabaseClient,
  employeeId: string,
  limit = 50,
): Promise<{ data: KnowledgeEntry[]; error: string | null }> {
  if (!isValidKnowledgeId(employeeId) || limit < 1 || limit > 50) {
    return { data: [], error: "Invalid knowledge request." };
  }

  const { data, error } = await client
    .from("knowledge_entries")
    .select("id,workspace_id,ai_employee_id,kind,title,question,content,verified,created_by,updated_by,created_at,updated_at")
    .eq("ai_employee_id", employeeId)
    .eq("verified", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: "Could not load verified knowledge." };
  return { data: (data ?? []) as KnowledgeEntry[], error: null };
}

export async function createKnowledgeEntry(
  client: SupabaseClient,
  employeeId: string,
  input: KnowledgeEntryInput,
): Promise<{ data: KnowledgeEntry | null; error: string | null }> {
  if (!isValidKnowledgeId(employeeId)) return { data: null, error: "Invalid AI Employee." };
  const validationError = validateKnowledgeEntryInput(input);
  if (validationError) return { data: null, error: validationError };

  const normalized = normalizedInput(input);
  const { data, error } = await client.rpc("create_knowledge_entry", {
    target_employee_id: employeeId,
    target_kind: normalized.kind,
    target_title: normalized.title,
    target_question: normalized.question,
    target_content: normalized.content,
    target_verified: normalized.verified,
  });

  if (error) return { data: null, error: "Could not create this knowledge entry." };
  return { data: data as KnowledgeEntry, error: null };
}

export async function updateKnowledgeEntry(
  client: SupabaseClient,
  employeeId: string,
  entryId: string,
  input: KnowledgeEntryInput,
): Promise<{ data: KnowledgeEntry | null; error: string | null }> {
  if (!isValidKnowledgeId(employeeId) || !isValidKnowledgeId(entryId)) {
    return { data: null, error: "Invalid knowledge entry." };
  }
  const validationError = validateKnowledgeEntryInput(input);
  if (validationError) return { data: null, error: validationError };

  const { data, error } = await client
    .from("knowledge_entries")
    .update(normalizedInput(input))
    .eq("id", entryId)
    .eq("ai_employee_id", employeeId)
    .select()
    .single();

  if (error) return { data: null, error: "Could not update this knowledge entry." };
  return { data: data as KnowledgeEntry, error: null };
}

export async function deleteKnowledgeEntry(
  client: SupabaseClient,
  employeeId: string,
  entryId: string,
): Promise<{ error: string | null }> {
  if (!isValidKnowledgeId(employeeId) || !isValidKnowledgeId(entryId)) {
    return { error: "Invalid knowledge entry." };
  }

  const { error } = await client
    .from("knowledge_entries")
    .delete()
    .eq("id", entryId)
    .eq("ai_employee_id", employeeId);

  return { error: error ? "Could not delete this knowledge entry." : null };
}

export function formatVerifiedKnowledge(entries: KnowledgeEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    if (!entry.verified) continue;
    const label = entry.kind === "faq"
      ? `FAQ — ${clean(entry.question)}`
      : `NOTE — ${clean(entry.title)}`;
    const value = `${label}: ${clean(entry.content)}`;
    const next = [...lines, value].join("\n");
    if (next.length > KNOWLEDGE_CONTEXT_MAX_LENGTH) break;
    lines.push(value);
  }

  return lines.join("\n");
}

function normalizedWords(value: string): Set<string> {
  const words = clean(value).toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.filter((word) => word.length > 1 && !STOP_WORDS.has(word)));
}

export function findVerifiedFaqAnswer(
  entries: KnowledgeEntry[],
  customerMessage: string,
): string | null {
  const message = clean(customerMessage).toLocaleLowerCase("en");
  const messageWords = normalizedWords(message);
  if (!message || messageWords.size === 0) return null;

  let best: { score: number; answer: string } | null = null;

  for (const entry of entries) {
    if (!entry.verified || entry.kind !== "faq") continue;
    const question = clean(entry.question).toLocaleLowerCase("en");
    const questionWords = normalizedWords(question);
    if (!question || questionWords.size === 0) continue;

    const overlap = [...questionWords].filter((word) => messageWords.has(word)).length;
    const exactish = message.includes(question) || question.includes(message);
    const score = exactish ? 1 : overlap / questionWords.size;
    const requiredOverlap = questionWords.size === 1 ? 1 : 2;

    if (overlap >= requiredOverlap && score >= 0.6 && (!best || score > best.score)) {
      best = {
        score,
        answer: clean(entry.content).slice(0, KNOWLEDGE_ANSWER_MAX_LENGTH),
      };
    }
  }

  return best?.answer || null;
}
