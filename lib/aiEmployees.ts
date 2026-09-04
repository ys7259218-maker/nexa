import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeLifecycleStatus } from "./employeeLifecycle";

export type AIEmployeeStatus = "Active" | "Offline";

export type AIEmployee = {
  id: string;
  user_id: string;
  name: string;
  business_name: string;
  phone: string;
  voice: string;
  language: string;
  status: AIEmployeeStatus;
  lifecycle_status?: EmployeeLifecycleStatus;
  automation_paused?: boolean;
  lifecycle_updated_at?: string;
  department: string;
  business_description: string;
  greeting_message: string;
  timezone: string;
  working_hours: string;
  accent: string;
  speaking_style: string;
  speaking_speed: string;
  tone: string;
  country: string;
  business_hours: string;
  call_forwarding_number: string;
  call_routing_rule: string;
  knowledge_website: string;
  knowledge_faq_document: string;
  knowledge_pdf_url: string;
  knowledge_notes: string;
  created_at: string;
};

export type AIEmployeeCreateInput = {
  name: string;
  business_name: string;
  phone?: string;
  voice?: string;
  language?: string;
};

export type AIEmployeeUpdateInput = {
  name?: string;
  business_name?: string;
  phone?: string;
  voice?: string;
  language?: string;
  department?: string;
  business_description?: string;
  greeting_message?: string;
  timezone?: string;
  working_hours?: string;
  accent?: string;
  speaking_style?: string;
  speaking_speed?: string;
  tone?: string;
  country?: string;
  business_hours?: string;
  call_forwarding_number?: string;
  call_routing_rule?: string;
  knowledge_website?: string;
  knowledge_faq_document?: string;
  knowledge_pdf_url?: string;
  knowledge_notes?: string;
};

export type DataResult<T> = { data: T; error: null } | { data: null; error: string };

const hasText = (value: string) => value.trim().length > 0;

export const KNOWLEDGE_FIELDS = [
  { key: "knowledge_website" as const, label: "Business website" },
  { key: "knowledge_faq_document" as const, label: "FAQ document" },
  { key: "knowledge_pdf_url" as const, label: "PDF reference" },
  { key: "knowledge_notes" as const, label: "Business notes" },
];

export function knowledgeSourceCount(employee: { knowledge_website: string; knowledge_faq_document: string; knowledge_pdf_url: string; knowledge_notes: string }): number {
  return KNOWLEDGE_FIELDS.filter((field) => hasText(employee[field.key])).length;
}

const NAME_MAX = 100;
const BUSINESS_NAME_MAX = 160;
const SHORT_TEXT_MAX = 200;
const LONG_TEXT_MAX = 500;

const TEXT_FIELD_LIMITS: Partial<Record<keyof AIEmployeeUpdateInput, number>> = {
  department: SHORT_TEXT_MAX,
  business_description: LONG_TEXT_MAX,
  greeting_message: LONG_TEXT_MAX,
  timezone: SHORT_TEXT_MAX,
  working_hours: LONG_TEXT_MAX,
  accent: SHORT_TEXT_MAX,
  speaking_style: SHORT_TEXT_MAX,
  speaking_speed: SHORT_TEXT_MAX,
  tone: SHORT_TEXT_MAX,
  country: SHORT_TEXT_MAX,
  business_hours: LONG_TEXT_MAX,
  call_forwarding_number: SHORT_TEXT_MAX,
  call_routing_rule: LONG_TEXT_MAX,
  knowledge_website: LONG_TEXT_MAX,
  knowledge_faq_document: LONG_TEXT_MAX,
  knowledge_pdf_url: LONG_TEXT_MAX,
  knowledge_notes: LONG_TEXT_MAX,
};

function cleanText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim();
}

export function validateAIEmployeeInput(
  input: AIEmployeeCreateInput | AIEmployeeUpdateInput,
): string | null {
  const name = cleanText(input.name);
  const businessName = cleanText(input.business_name);

  if (name !== undefined && name.length === 0) {
    return "AI Employee Name is required.";
  }

  if (name !== undefined && name.length > NAME_MAX) {
    return `AI Employee Name must be at most ${NAME_MAX} characters.`;
  }

  if (businessName !== undefined && businessName.length === 0) {
    return "Business Name is required.";
  }

  if (businessName !== undefined && businessName.length > BUSINESS_NAME_MAX) {
    return `Business Name must be at most ${BUSINESS_NAME_MAX} characters.`;
  }

  for (const [field, limit] of Object.entries(TEXT_FIELD_LIMITS)) {
    const value = cleanText(
      (input as AIEmployeeUpdateInput)[field as keyof AIEmployeeUpdateInput] as
        | string
        | undefined,
    );

    if (value !== undefined && value.length > limit) {
      const label = field.replaceAll("_", " ");
      return `${label} must be at most ${limit} characters.`;
    }
  }

  return null;
}

/**
 * Every function here runs through Supabase with the signed-in user's
 * cookie session. Row Level Security on public.ai_employees scopes all
 * reads and writes to auth.uid() = user_id; this module never uses the
 * service-role key.
 */
export async function listAIEmployees(
  client: SupabaseClient,
): Promise<DataResult<AIEmployee[]>> {
  const { data, error } = await client
    .from("ai_employees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}

export async function getAIEmployee(
  client: SupabaseClient,
  id: string,
): Promise<DataResult<AIEmployee | null>> {
  const { data, error } = await client
    .from("ai_employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? null, error: null };
}

export async function createAIEmployee(
  client: SupabaseClient,
  input: AIEmployeeCreateInput,
): Promise<DataResult<AIEmployee>> {
  const validationError = validateAIEmployeeInput(input);

  if (validationError) {
    return { data: null, error: validationError };
  }

  const { data, error } = await client
    .from("ai_employees")
    .insert({
      name: cleanText(input.name),
      business_name: cleanText(input.business_name),
      phone: input.phone?.trim() ?? "",
      voice: input.voice ?? "Female",
      language: input.language ?? "English",
      status: "Offline",
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function updateAIEmployee(
  client: SupabaseClient,
  id: string,
  input: AIEmployeeUpdateInput,
): Promise<DataResult<AIEmployee>> {
  const validationError = validateAIEmployeeInput(input);

  if (validationError) {
    return { data: null, error: validationError };
  }

  const changes: Record<string, unknown> = {};

  if (input.name !== undefined) changes.name = cleanText(input.name);
  if (input.business_name !== undefined) {
    changes.business_name = cleanText(input.business_name);
  }
  if (input.phone !== undefined) changes.phone = input.phone.trim();
  if (input.voice !== undefined) changes.voice = input.voice;
  if (input.language !== undefined) changes.language = input.language;

  for (const field of Object.keys(TEXT_FIELD_LIMITS)) {
    const value = cleanText(
      input[field as keyof AIEmployeeUpdateInput] as string | undefined,
    );

    if (value !== undefined) {
      changes[field] = value;
    }
  }

  if (Object.keys(changes).length === 0) {
    return { data: null, error: "Nothing to update." };
  }

  const { data, error } = await client
    .from("ai_employees")
    .update(changes)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function deleteAIEmployee(
  client: SupabaseClient,
  id: string,
): Promise<DataResult<true>> {
  const { error } = await client.from("ai_employees").delete().eq("id", id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: true, error: null };
}
