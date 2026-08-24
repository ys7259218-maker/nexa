import { isValidInternalBearer } from "./internalAuth.ts";

export type RetrySummary = {
  accepted: number;
  duplicates: number;
  skipped: number;
  failed: number;
};

type RetryFunction = (limit: number) => Promise<RetrySummary>;

const RETRY_BATCH_LIMIT = 10;

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleRetryRequest(
  request: Request,
  configuredSecret: string | undefined,
  retry: RetryFunction,
): Promise<Response> {
  if (!configuredSecret || configuredSecret.trim().length < 32) {
    return json({ error: "Retry service is not configured" }, 503);
  }

  if (!isValidInternalBearer(request.headers.get("authorization"), configuredSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const summary = await retry(RETRY_BATCH_LIMIT);
    return json({ ok: true, summary }, 200);
  } catch {
    return json({ error: "Retry service failed" }, 500);
  }
}

