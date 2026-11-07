import "server-only";

import type { AIProvider } from "@/lib/ai/provider";
import { MockAIProvider } from "@/lib/ai/mockProvider";
import { OpenAIProvider } from "@/lib/ai/openAIProvider";
import { OpenAICompatibleProvider } from "@/lib/ai/openAICompatibleProvider";
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

  if (status.kind === "openai-compatible" && status.ready) {
    return new OpenAICompatibleProvider(
      (process.env.AI_API_KEY ?? "").trim(),
      (process.env.AI_MODEL ?? "").trim(),
      (process.env.AI_BASE_URL ?? "").trim(),
    );
  }

  if (status.kind === "openai-compatible") {
    console.warn(
      "OpenAI-compatible provider configuration is incomplete; using the safe mock provider.",
    );
    return new MockAIProvider();
  }

  if (status.kind === "unsupported") {
    console.warn(`Unknown AI_PROVIDER "${status.value}"; using the safe mock provider.`);
  }

  return new MockAIProvider();
}

