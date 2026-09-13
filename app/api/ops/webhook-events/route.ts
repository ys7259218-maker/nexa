import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: SECURITY_HEADERS });
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  return json(
    {
      error:
        "Webhook ledger is temporarily unavailable while workspace scoping is being hardened.",
    },
    503,
  );
}
