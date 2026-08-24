import { NextResponse, type NextRequest } from "next/server";

import { getSafeRecoveryDestination } from "@/lib/authRedirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = getSafeRecoveryDestination(request.nextUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/login?recovery=invalid", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?recovery=invalid", request.url));
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
