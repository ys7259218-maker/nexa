import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export const getAuthenticatedUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return null;
    }

    // Secure check: validates the token with Supabase instead of trusting
    // cookie presence alone.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return { id: user.id, email: user.email ?? "" };
  },
);

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
