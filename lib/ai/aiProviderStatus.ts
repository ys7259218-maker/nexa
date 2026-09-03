export type AIProviderStatus =
  | { kind: "mock" }
  | { kind: "openai"; ready: boolean }
  | { kind: "unsupported"; value: string };

/**
 * Describes the configured AI provider without ever exposing secrets. For
 * OpenAI only a ready/hasKey boolean is reported, never the key itself, so
 * this value is safe to pass through a server component to a client
 * component for display.
 */
export function describeAIProviderStatus(
  env: Record<string, string | undefined> = process.env,
): AIProviderStatus {
  const configured = (env.AI_PROVIDER ?? "mock").trim().toLowerCase();

  if (!configured) {
    return { kind: "mock" };
  }

  if (configured === "openai") {
    const apiKey = env.OPENAI_API_KEY?.trim();
    const model = env.OPENAI_MODEL?.trim();
    return { kind: "openai", ready: Boolean(apiKey && model) };
  }

  if (configured === "mock") {
    return { kind: "mock" };
  }

  return { kind: "unsupported", value: configured };
}
