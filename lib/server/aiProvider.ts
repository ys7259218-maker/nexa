import "server-only";

import type { AIProvider } from "@/lib/ai/provider";
import { MockAIProvider } from "@/lib/ai/mockProvider";
import { OpenAIProvider } from "@/lib/ai/openAIProvider";
import { describeAIProviderStatus } from "@/lib/ai/aiProviderStatus";

export function getAIProvider(): AIProvider {
  const status = describeAIProviderStatus();

  if (status.kind === "openai" && status.ready) {
    return new OpenAIProvider(
      (process.env.OPENAI_API_KEY ?? "").trim(),
      (process.env.OPENAI_MODEL ?? "").trim(),
    );
  }

  if (status.kind === "openai") {
    console.warn("OpenAI provider configuration is incomplete; using the safe mock provider.");
    return new MockAIProvider();
  }

  if (status.kind === "unsupported") {
    console.warn(`Unknown AI_PROVIDER "${status.value}"; using the safe mock provider.`);
  }

  return new MockAIProvider();
}

