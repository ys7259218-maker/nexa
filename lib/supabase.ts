import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://yffxzdntsgksmvmrutfw.supabase.co";

const supabaseAnonKey =
  "sb_publishable_GRLrkcVKfCkqegD7JWz5Jg_4bmi00SB";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);