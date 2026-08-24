import "server-only";

import type { AIProvider } from "@/lib/ai/provider";
import { MockAIProvider } from "@/lib/ai/mockProvider";
import { OpenAIProvider } from "@/lib/ai/openAIProvider";

export function getAIProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase();

  if (configured === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim();

    if (apiKey && model) {
      return new OpenAIProvider(apiKey, model);
    }

    console.warn("OpenAI provider configuration is incomplete; using the safe mock provider.");
    return new MockAIProvider();
  }

  if (configured !== "mock") {
    console.warn(`Unknown AI_PROVIDER "${configured}"; using the safe mock provider.`);
  }

  return new MockAIProvider();
}

