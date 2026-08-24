import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveProxyRedirect } from "@/lib/proxyRouting";

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail safe: without configuration there is no auth to enforce.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes expired access tokens so server components see a valid session.
  // Do not run any code between the client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = resolveProxyRedirect(
    request.nextUrl.pathname,
    Boolean(user),
  );

  if (redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/ai-employees/:path*", "/conversations/:path*", "/login", "/signup"],
};
