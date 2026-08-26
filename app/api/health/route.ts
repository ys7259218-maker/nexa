const HEALTH_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(JSON.stringify({ status: "ready" }), {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}
