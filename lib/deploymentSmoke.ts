type FetchLike = typeof fetch;
const DEFAULT_TIMEOUT_MS = 10_000;

export function parseDeploymentBaseUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Deployment URL must be a credential-free HTTPS origin.");
  }
  return url;
}

function isLoginRedirect(response: Response, baseUrl: URL) {
  if (![301, 302, 303, 307, 308].includes(response.status)) return false;
  const location = response.headers.get("location");
  if (!location) return false;
  const target = new URL(location, response.url || baseUrl);
  return (
    target.protocol === "https:" &&
    target.origin === baseUrl.origin &&
    !target.username &&
    !target.password &&
    target.pathname === "/login"
  );
}

async function safeFetch(
  label: string,
  url: URL,
  init: RequestInit,
  issues: string[],
  fetchImplementation: FetchLike,
  timeoutMs: number,
) {
  try {
    return await fetchImplementation(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    issues.push(`${label} request failed or timed out.`);
    return null;
  }
}

export async function inspectDeployment(
  baseUrlValue: string,
  fetchImplementation: FetchLike = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const baseUrl = parseDeploymentBaseUrl(baseUrlValue);
  const issues: string[] = [];

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    throw new Error("Deployment smoke timeout must be between 100 and 60000 milliseconds.");
  }

  const root = await safeFetch(
    "Root page",
    new URL("/", baseUrl),
    { redirect: "manual" },
    issues,
    fetchImplementation,
    timeoutMs,
  );
  if (root && root.status !== 200) issues.push("Root page did not return HTTP 200.");

  const health = await safeFetch(
    "Health GET",
    new URL("/api/health", baseUrl),
    { redirect: "manual", headers: { Accept: "application/json" } },
    issues,
    fetchImplementation,
    timeoutMs,
  );
  if (health && health.status !== 200) {
    issues.push("Health GET did not return HTTP 200.");
  } else if (health) {
    const body = await health.text();
    if (body !== '{"status":"ready"}') issues.push("Health GET body was not the exact safe contract.");
    if (!health.headers.get("cache-control")?.includes("no-store")) {
      issues.push("Health GET did not include a no-store cache policy.");
    }
  }

  const healthHead = await safeFetch(
    "Health HEAD",
    new URL("/api/health", baseUrl),
    { method: "HEAD", redirect: "manual" },
    issues,
    fetchImplementation,
    timeoutMs,
  );
  if (healthHead && healthHead.status !== 200) issues.push("Health HEAD did not return HTTP 200.");
  if (healthHead && (await healthHead.text()) !== "") {
    issues.push("Health HEAD unexpectedly returned a body.");
  }

  const dashboard = await safeFetch(
    "Unauthenticated dashboard",
    new URL("/dashboard", baseUrl),
    { redirect: "manual" },
    issues,
    fetchImplementation,
    timeoutMs,
  );
  if (dashboard && !isLoginRedirect(dashboard, baseUrl)) {
    issues.push("Unauthenticated dashboard request did not redirect to /login.");
  }

  return issues;
}
