import type { SupabaseClient } from "@supabase/supabase-js";

export interface WhatsAppChannel {
  id: string;
  phone_number_id: string;
  display_name: string;
  created_at: string;
}

export interface MutationResult<T> {
  data: T | null;
  error: string | null;
}

export async function listWhatsAppChannels(
  supabase: SupabaseClient,
  limit = 10,
): Promise<{ data: WhatsAppChannel[]; error: string | null }> {
  const { data, error } = await supabase
    .from("whatsapp_channels")
    .select("id, phone_number_id, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [], error: "Could not load WhatsApp channels." };
  }

  return { data: (data ?? []) as WhatsAppChannel[], error: null };
}

export async function saveWhatsAppChannel(
  supabase: SupabaseClient,
  input: { phoneNumberId: string; displayName: string },
): Promise<MutationResult<WhatsAppChannel>> {
  const phoneNumberId = input.phoneNumberId.trim();
  const displayName = input.displayName.trim();

  if (!phoneNumberId) {
    return { data: null, error: "Phone Number ID is required." };
  }

  if (phoneNumberId.length > 200 || displayName.length > 200) {
    return { data: null, error: "Phone Number ID and display name must be 200 characters or fewer." };
  }

  const { data, error } = await supabase
    .from("whatsapp_channels")
    .upsert(
      { phone_number_id: phoneNumberId, display_name: displayName },
      { onConflict: "phone_number_id" },
    )
    .select("id, phone_number_id, display_name, created_at")
    .single();

  if (error) {
    return {
      data: null,
      error:
        "Could not save this Phone Number ID. It may already be linked to another account.",
    };
  }

  return { data: data as WhatsAppChannel, error: null };
}
