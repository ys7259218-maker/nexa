import type { SupabaseClient } from "@supabase/supabase-js";

export interface WhatsAppChannel {
  id: string;
  phone_number_id: string;
  display_name: string;
  ai_employee_id: string | null;
  created_at: string;
}

export interface MutationResult<T> {
  data: T | null;
  error: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 36 && UUID_PATTERN.test(value);
}

export async function listWhatsAppChannels(
  supabase: SupabaseClient,
  limit = 10,
  includeAssignment = false,
): Promise<{ data: WhatsAppChannel[]; error: string | null }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { data: [], error: "Invalid WhatsApp channel request." };
  }

  const columns = includeAssignment
    ? "id, phone_number_id, display_name, ai_employee_id, created_at"
    : "id, phone_number_id, display_name, created_at";
  const { data, error } = await supabase
    .from("whatsapp_channels")
    .select(columns)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [], error: "Could not load WhatsApp channels." };
  }

  const channels = (data ?? []) as unknown as Array<Omit<WhatsAppChannel, "ai_employee_id"> & {
    ai_employee_id?: string | null;
  }>;
  return {
    data: channels.map((channel) => ({
      ...channel,
      ai_employee_id: channel.ai_employee_id ?? null,
    })),
    error: null,
  };
}

export async function saveWhatsAppChannel(
  supabase: SupabaseClient,
  input: { phoneNumberId: string; displayName: string; employeeId?: string },
): Promise<MutationResult<WhatsAppChannel>> {
  const phoneNumberId = input.phoneNumberId.trim();
  const displayName = input.displayName.trim();

  if (!phoneNumberId) {
    return { data: null, error: "Phone Number ID is required." };
  }

  if (phoneNumberId.length > 200 || displayName.length > 200) {
    return { data: null, error: "Phone Number ID and display name must be 200 characters or fewer." };
  }

  if (input.employeeId !== undefined && !isValidId(input.employeeId)) {
    return { data: null, error: "Choose a valid AI Employee for this channel." };
  }

  const assignment = input.employeeId ? { ai_employee_id: input.employeeId } : {};
  const columns = input.employeeId
    ? "id, phone_number_id, display_name, ai_employee_id, created_at"
    : "id, phone_number_id, display_name, created_at";

  const { data, error } = await supabase
    .from("whatsapp_channels")
    .upsert(
      { phone_number_id: phoneNumberId, display_name: displayName, ...assignment },
      { onConflict: "phone_number_id" },
    )
    .select(columns)
    .single();

  if (error) {
    return {
      data: null,
      error:
        "Could not save this Phone Number ID. It may already be linked to another account.",
    };
  }

  const channel = data as unknown as Omit<WhatsAppChannel, "ai_employee_id"> & {
    ai_employee_id?: string | null;
  };
  return {
    data: { ...channel, ai_employee_id: channel.ai_employee_id ?? null },
    error: null,
  };
}

export async function assignWhatsAppChannel(
  supabase: SupabaseClient,
  channelId: string,
  employeeId: string,
): Promise<MutationResult<WhatsAppChannel>> {
  if (!isValidId(channelId) || !isValidId(employeeId)) {
    return { data: null, error: "Invalid WhatsApp channel assignment." };
  }

  const { data, error } = await supabase
    .from("whatsapp_channels")
    .update({ ai_employee_id: employeeId })
    .eq("id", channelId)
    .select("id, phone_number_id, display_name, ai_employee_id, created_at")
    .single();

  if (error) {
    return {
      data: null,
      error: "Could not assign this channel. Check workspace access and try again.",
    };
  }

  return { data: data as WhatsAppChannel, error: null };
}
